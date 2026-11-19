
/* ============================================================
   NEON NAGAR : CITY HUSTLE  —  third arcade game (original)
   top-down 2.5D open city · walk · drive · 5 missions
   ============================================================ */
(function(){
  'use strict';
  var layer = document.getElementById('cityLayer');
  if(!layer) return;

  var canvas = document.getElementById('cityCanvas');
  var ctx = canvas.getContext('2d');
  var miniEl = document.getElementById('cityMini');
  var mctx = miniEl.getContext('2d');

  function el(id){ return document.getElementById(id); }
  var uiStart = el('cityStart'), uiPause = el('cityPauseScreen'), uiModal = el('cityModal');
  var elName = el('cityMisName'), elObj = el('cityObjText'), elProg = el('cityProg');
  var elCoins = el('cityCoins'), elTimer = el('cityTimer'), elSpeed = el('citySpeedVal');
  var elNitro = el('cityNitro'), elToast = el('cityToast'), elStick = el('cityStick');
  var elMinis = el('cityMiniWrap'), elModalBody = el('cityModalBody');
  var elBtnSound = el('citySound'), elBtnPause = el('cityPause'), elPad = el('cityPad');

  /* ---------------- city layout ---------------- */
  var GRID = 7, PITCH = 430, ROADW = 96;
  var BLOCK = PITCH - ROADW;                 /* 334 */
  var WORLD = GRID * PITCH + ROADW;          /* 3106 */
  var WORLD_MIN = ROADW * 0.5, WORLD_MAX = WORLD - ROADW * 0.5;

  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261119);

  function blockRect(i, j){ return { x: i * PITCH + ROADW, y: j * PITCH + ROADW, w: BLOCK, h: BLOCK }; }
  function blockCenter(i, j){ var b = blockRect(i, j); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

  /* sunny California palette — stucco, sand, tile roofs, palm green */
  var WALLS = ['#d9cdb4', '#e6dac0', '#cdbc9c', '#c2b195', '#dcc9a6', '#cbb69a', '#e9dfc8', '#b7a98f'];
  var ROOFS = ['#b9a98c', '#a99a80', '#c4b295', '#9d8f78', '#b0a086', '#c8b79b', '#8f8472'];
  var NEONS = ['#ffe6b8', '#ffeccb', '#d8ecff', '#ffd8b0', '#eef6ff', '#fff3d6'];

  var buildings = [], parks = [], props = [], crates = [], lamps = [], traffic = [];
  var landmarks = {};

  function shade(hex, k){
    var h = hex.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b2 = parseInt(h.slice(4, 6), 16);
    if(k < 0){ var f = 1 + k; r = Math.round(r * f); g = Math.round(g * f); b2 = Math.round(b2 * f); }
    else { r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b2 = Math.round(b2 + (255 - b2) * k); }
    return 'rgb(' + r + ',' + g + ',' + b2 + ')';
  }

  var zoneNow = 'suburb';

  function addBuilding(x, y, w, h, tag){
    var wall = WALLS[(rnd() * WALLS.length) | 0];
    var roof = ROOFS[(rnd() * ROOFS.length) | 0];
    var neon = NEONS[(rnd() * NEONS.length) | 0];
    var hgt = 24 + Math.round(rnd() * 22);
    var b = {
      x: x, y: y, w: w, h: h, hgt: hgt, wall: wall, roof: roof, neon: neon,
      sign: rnd() > 0.55, tag: tag || null, zone: zoneNow,
      winRow: 2 + ((rnd() * 2) | 0), lit: rnd() > 0.35,
      roofA: null, roofB: null, wallA: null, wallB: null
    };
    b.roofA = b.roof;
    b.roofB = shade(b.roof, -0.34);
    b.wallA = shade(b.roof, -0.62);
    b.wallB = shade(b.roof, -0.82);
    buildings.push(b);
    return b;
  }

  function makePark(b, name){
    parks.push({ x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 20, name: name || null });
    var n = 7 + ((rnd() * 4) | 0);
    for(var i = 0; i < n; i++){
      trees.push({ x: b.x + 24 + rnd() * (b.w - 48), y: b.y + 24 + rnd() * (b.h - 48), r: 15 + rnd() * 9, s: rnd(), palm: rnd() > 0.55 ? 1 : 0 });
    }
  }
  var trees = [];

  function makeParking(b){
    landmarks.lot = { x: b.x + 16, y: b.y + 16, w: b.w - 32, h: b.h - 32 };
    landmarks.bay = { x: b.x + 40, y: b.y + 60, w: 86, h: 150, cx: b.x + 40 + 43, cy: b.y + 60 + 75 };
    props.push({ type: 'paint', x: b.x + 16, y: b.y + 16, w: b.w - 32, h: b.h - 32 });
  }

  function palmRow(){
    /* palms down the kerbs, like the boulevards */
    for(var j = 0; j <= GRID; j++){
      for(var i = 0; i <= GRID; i++){
        var bx = i * PITCH + ROADW, bz = j * PITCH + ROADW;
        for(var t = 0; t < 3; t++){
          var f = 0.18 + t * 0.3;
          trees.push({ x: bx + BLOCK * f, y: bz - 22, r: 13 + ((i + j + t) % 3) * 2.5, s: rnd(), palm: 1 });
          trees.push({ x: bx - 22, y: bz + BLOCK * f, r: 13 + ((i + j + t) % 4) * 2.2, s: rnd(), palm: 1 });
        }
      }
    }
  }

  function makeStreets(){
    /* street lamps on every intersection corner */
    for(var j = 0; j <= GRID; j++){
      for(var i = 0; i <= GRID; i++){
        var x = i * PITCH + ROADW / 2, y = j * PITCH + ROADW / 2;
        lamps.push({ x: x, y: y, a: (i * 7 + j * 13) % 3 });
      }
    }
  }

  function scatterCrates(){
    crates.length = 0;
    var spots = [
      [2, 1], [4, 0], [0, 2], [5, 3], [6, 5], [1, 6], [3, 5], [5, 6]
    ];
    for(var i = 0; i < spots.length; i++){
      var b = blockRect(spots[i][0], spots[i][1]);
      var side = i % 2;                       /* 0 = roadway under the block, 1 = roadway to its right */
      var f = 0.18 + ((i * 5) % 7) * 0.09;
      crates.push({
        x: side ? b.x + b.w + 46 : b.x + 46 + f * (b.w - 92),
        y: side ? b.y + 46 + f * (b.h - 92) : b.y + b.h + 46,
        r: 15, alive: true, hue: i % 3
      });
    }
  }

  function buildCity(){
    buildings = []; parks = []; props = []; lamps = []; trees = []; landmarks = {};
    var g = blockCenter(1, 1);
    landmarks.garage = { x: g.x, y: g.y };
    var shopB = blockRect(5, 2);
    landmarks.shop = { x: shopB.x - 46, y: shopB.y + shopB.h / 2 };   /* kerb outside Curry Corner */
    var towerB = blockRect(4, 5);
    landmarks.tower = { x: towerB.x + towerB.w / 2, y: towerB.y + towerB.h + 46 };  /* plaza in front of Neon Tower */
    var plazaC = blockCenter(2, 4);
    landmarks.plaza = { x: plazaC.x, y: plazaC.y };

    for(var j = 0; j < GRID; j++){
      for(var i = 0; i < GRID; i++){
        var b = blockRect(i, j);
        var key = i + ',' + j;
        /* downtown in the middle, warehouses at the edges, houses in between */
        var dd0 = Math.sqrt((i - 3) * (i - 3) + (j - 3) * (j - 3));
        zoneNow = dd0 < 1.6 ? 'downtown' : (dd0 > 3.4 ? 'industrial' : 'suburb');
        if(key === '2,4'){ makePark(b, 'tape plaza'); continue; }
        if(key === '6,0'){ makePark(b); continue; }
        if(key === '3,2'){ makeParking(b); continue; }
        if(key === '1,1'){
          /* Rustom Garage — one wide low shed + open forecourt */
          addBuilding(b.x + 24, b.y + 22, b.w - 48, 132, 'garage');
          props.push({ type: 'garageSign', x: b.x + b.w / 2, y: b.y + 168 });
          props.push({ type: 'paint', x: b.x + 30, y: b.y + 178, w: b.w - 60, h: b.h - 200 });
          continue;
        }
        var big = zoneNow === 'industrial' ? true : rnd() > 0.5;
        if(big){
          addBuilding(b.x + 28, b.y + 28, b.w - 56, b.h - 56, 'large');
        } else {
          var m = 24, gap = 16;
          var hw = (b.w - m * 2 - gap) / 2, hh = (b.h - m * 2 - gap) / 2;
          addBuilding(b.x + m, b.y + m, hw, hh, 'small');
          addBuilding(b.x + m + hw + gap, b.y + m, hw, hh, 'small');
          addBuilding(b.x + m, b.y + m + hh + gap, hw, hh, 'small');
          addBuilding(b.x + m + hw + gap, b.y + m + hh + gap, hw, hh, 'small');
        }
      }
    }
    makeStreets();
    palmRow();
    scatterCrates();

    /* name the landmarks so the city reads like a real place */
    var named = [
      [landmarks.garage, 'RUSTOM GARAGE', '#7cf59a'],
      [landmarks.shop, 'CURRY CORNER', '#ffd166'],
      [landmarks.tower, 'NEON TOWER', '#33e0ff']
    ];
    for(var n = 0; n < named.length; n++){
      var best = null, bd = 1e9;
      for(var bi2 = 0; bi2 < buildings.length; bi2++){
        var bb = buildings[bi2];
        var dd = dist(named[n][0].x, named[n][0].y, bb.x + bb.w / 2, bb.y + bb.h / 2);
        if(dd < bd){ bd = dd; best = bb; }
      }
      if(best && best.w > 110){ best.label = named[n][1]; best.labelColor = named[n][2]; }
    }
    buildGLStatic();
  }

  /* ---------------- entities ---------------- */
  var player = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, r: 10, walk: 0, inCar: false, dash: 0 };
  var car = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, w: 46, h: 24, nitro: 1, boost: 0, skid: 0 };
  var cam = { x: 0, y: 0, sx: 0, sy: 0, shake: 0, zoom: 1 };
  var DPR = 1, W = 0, H = 0, playing = false, paused = false;
  var particles = [], skids = [], pops = [];

  function resetWorld(){
    buildCity();
    var g = landmarks.garage;
    player.x = g.x - 60; player.y = g.y + 150; player.vx = 0; player.vy = 0; player.ang = -Math.PI / 2; player.inCar = false;
    car.x = g.x + 40; car.y = g.y + 150; car.vx = 0; car.vy = 0; car.ang = -Math.PI / 2; car.nitro = 1; car.boost = 0;
    particles.length = 0; skids.length = 0; pops.length = 0;
    makeTraffic();
    makePeds();
    cam.zoom = 1;
  }

  var TRAFFIC_COLORS = ['#ff6b8b', '#5ad1ff', '#ffd166', '#9b8cff', '#66e0a3', '#ff9f45'];
  function makeTraffic(){
    traffic = [];
    for(var i = 0; i < 9; i++){
      var horiz = rnd() > 0.5;
      var idx = 1 + ((rnd() * (GRID - 1)) | 0);
      var dir = rnd() > 0.5 ? 1 : -1;
      var t = {
        horiz: horiz, idx: idx, dir: dir,
        pos: rnd() * WORLD,
        speed: 90 + rnd() * 46,
        color: TRAFFIC_COLORS[(rnd() * TRAFFIC_COLORS.length) | 0],
        w: 42, h: 22, ang: 0
      };
      t.ang = horiz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      traffic.push(t);
    }
  }

  var peds = [];
  var PED_SIDES = [[0,1,0],[3,0,2],[2,3,1],[6,4,3],[4,6,0],[1,4,2],[5,1,1],[3,6,3],[0,5,0],[6,6,2]];
  var PED_COLORS = ['#ff9fb0', '#9fd7ff', '#ffe08a', '#b8a6ff', '#9ff0c0'];
  function makePeds(){
    peds = [];
    for(var i = 0; i < PED_SIDES.length; i++){
      var b = blockRect(PED_SIDES[i][0], PED_SIDES[i][1]);
      var side = PED_SIDES[i][2];
      var len = (side % 2 === 0) ? b.w - 24 : b.h - 24;
      peds.push({ b: b, side: side, len: len, pos: (((i * 37) % 100) / 100) * len,
        dir: i % 2 ? -1 : 1, sp: 24 + (i % 4) * 7, color: PED_COLORS[i % PED_COLORS.length],
        hop: 0, x: 0, y: 0 });
    }
    for(var j = 0; j < peds.length; j++) placePed(peds[j]);
  }
  function placePed(p){
    var b = p.b;
    if(p.side === 0){ p.x = b.x + 12 + p.pos; p.y = b.y + 12; }
    else if(p.side === 1){ p.x = b.x + b.w - 12; p.y = b.y + 12 + p.pos; }
    else if(p.side === 2){ p.x = b.x + 12 + p.pos; p.y = b.y + b.h - 12; }
    else { p.x = b.x + 12; p.y = b.y + 12 + p.pos; }
  }
  function updatePeds(dt){
    for(var i = 0; i < peds.length; i++){
      var p = peds[i];
      p.pos += p.dir * p.sp * dt;
      if(p.pos > p.len){ p.pos = p.len; p.dir = -1; }
      if(p.pos < 0){ p.pos = 0; p.dir = 1; }
      placePed(p);
      var near = dist(p.x, p.y, car.x, car.y);
      if(near < 80) p.hop = Math.min(1, p.hop + dt * 3.6);
      else p.hop = Math.max(0, p.hop - dt * 1.7);
    }
  }

  function trafficPos(t){
    if(t.horiz){
      return { x: t.pos, y: t.idx * PITCH + ROADW / 2 + (t.dir > 0 ? 22 : -22) };
    }
    return { x: t.idx * PITCH + ROADW / 2 + (t.dir > 0 ? -22 : 22), y: t.pos };
  }

  /* ---------------- input ---------------- */
  var keys = {};
  var stick = { active: false, dx: 0, dy: 0, id: null, x: 0, y: 0 };
  var btn = { enter: false, drift: false, boost: false, enterEdge: false };

  function keyName(e){
    var k = e.key;
    if(!k) return '';
    return k.length === 1 ? k.toLowerCase() : k;
  }
  document.addEventListener('keydown', function(e){
    if(!playing || layer.hidden) return;
    var k = keyName(e);
    if(k === 'Escape' || k === 'p'){ e.preventDefault(); togglePause(); return; }
    if(k === 'e'){ e.preventDefault(); btn.enterEdge = true; }
    if(k === 't'){ e.preventDefault(); skipTime(); return; }
    if(k === ' '){ e.preventDefault(); keys.brake = true; }
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].indexOf(k) > -1){ e.preventDefault(); }
    keys[k] = true;
  }, {passive: false});
  document.addEventListener('keyup', function(e){
    var k = keyName(e);
    if(k === ' ') keys.brake = false;
    keys[k] = false;
  });

  /* ---------------- drive pad (right thumb): gas / brake / steer ---------------- */
  var driveHeld = { up: 0, down: 0, left: 0, right: 0 };
  function driveSync(){
    var dx = (driveHeld.right ? 1 : 0) - (driveHeld.left ? 1 : 0);
    var dy = (driveHeld.down ? 1 : 0) - (driveHeld.up ? 1 : 0);
    var len = Math.sqrt(dx * dx + dy * dy);
    if(len > 1){ dx = dx / len; dy = dy / len; }
    stick.active = !!(dx || dy);
    stick.dx = dx; stick.dy = dy;
  }
  function driveRelease(){
    driveHeld.up = 0; driveHeld.down = 0; driveHeld.left = 0; driveHeld.right = 0;
    driveSync();
    if(!elStick) return;
    var on = elStick.querySelectorAll('.nn__dbtn.on');
    for(var i = 0; i < on.length; i++) on[i].classList.remove('on');
  }
  if(elStick){
    var dbts = elStick.querySelectorAll('.nn__dbtn');
    var mk = function(b, down){
      return function(ev){
        if(ev && ev.cancelable) ev.preventDefault();
        var d = b.getAttribute('data-dir');
        if(!d) return;
        driveHeld[d] = down ? 1 : 0;
        if(down) b.classList.add('on'); else b.classList.remove('on');
        driveSync();
      };
    };
    for(var di = 0; di < dbts.length; di++){
      (function(b){
        var on = mk(b, true), off = mk(b, false);
        b.addEventListener('touchstart', on, {passive: false});
        b.addEventListener('touchend', off, {passive: false});
        b.addEventListener('touchcancel', off, {passive: false});
        b.addEventListener('pointerdown', function(ev){
          if(ev.pointerType === 'touch' && 'ontouchstart' in window) return;
          on(ev);
          if(b.setPointerCapture){ try{ b.setPointerCapture(ev.pointerId); }catch(err){} }
        }, {passive: false});
        b.addEventListener('pointerup', function(ev){
          if(ev.pointerType === 'touch' && 'ontouchstart' in window) return;
          off(ev);
        });
        b.addEventListener('pointercancel', off);
        b.addEventListener('contextmenu', function(ev){ ev.preventDefault(); });
      })(dbts[di]);
    }
    window.addEventListener('blur', driveRelease);
    if(document.addEventListener){
      document.addEventListener('visibilitychange', function(){ if(document.hidden) driveRelease(); });
    }
  }

  function bindHold(id, prop){
    var b = el(id);
    if(!b) return;
    var on = function(e){ if(e.cancelable) e.preventDefault(); btn[prop] = true; b.classList.add('on'); };
    var off = function(e){ if(e && e.cancelable) e.preventDefault(); btn[prop] = false; b.classList.remove('on'); };
    b.addEventListener('touchstart', on, {passive: false});
    b.addEventListener('touchend', off, {passive: false});
    b.addEventListener('touchcancel', off, {passive: false});
    b.addEventListener('pointerdown', function(e){ if(e.pointerType === 'touch' && 'ontouchstart' in window) return; on(e); }, {passive: false});
    b.addEventListener('pointerup', function(e){ if(e.pointerType === 'touch' && 'ontouchstart' in window) return; off(e); });
    b.addEventListener('pointerleave', off);
    b.addEventListener('click', function(e){ e.preventDefault(); });
  }
  bindHold('cityDrift', 'drift');
  bindHold('cityBoost', 'boost');
  (function(){
    var b = el('cityEnter');
    if(!b) return;
    var fire = function(e){ if(e && e.cancelable) e.preventDefault(); btn.enterEdge = true; b.classList.add('on'); setTimeout(function(){ b.classList.remove('on'); }, 130); };
    b.addEventListener('touchstart', fire, {passive: false});
    b.addEventListener('pointerdown', function(e){ if(e.pointerType === 'touch' && 'ontouchstart' in window) return; fire(e); }, {passive: false});
    b.addEventListener('click', function(e){ e.preventDefault(); });
  })();

  /* ---------------- helpers ---------------- */
  function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function dist(ax, ay, bx, by){ var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function rrect(c, x, y, w, h, r){
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  var audio = { on: true, ctx: null };
  function beep(freq, dur, type, gain){
    if(!audio.on) return;
    try{
      if(!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var c = audio.ctx;
      if(c.state === 'suspended') c.resume();
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.value = gain == null ? 0.05 : gain;
      o.connect(g); g.connect(c.destination);
      var t = c.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    }catch(err){}
  }
  function sfx(kind){
    if(!audio.on) return;
    if(kind === 'pick') beep(880, 0.12, 'triangle', 0.06);
    else if(kind === 'coin'){ beep(1180, 0.09, 'triangle', 0.05); setTimeout(function(){ beep(1560, 0.1, 'triangle', 0.045); }, 70); }
    else if(kind === 'crash') beep(120, 0.16, 'sawtooth', 0.07);
    else if(kind === 'win'){ beep(660, 0.12, 'triangle', 0.06); setTimeout(function(){ beep(880, 0.12, 'triangle', 0.06); }, 120); setTimeout(function(){ beep(1320, 0.16, 'triangle', 0.06); }, 250); }
    else if(kind === 'fail'){ beep(300, 0.18, 'sawtooth', 0.06); setTimeout(function(){ beep(180, 0.24, 'sawtooth', 0.06); }, 150); }
    else if(kind === 'smash') beep(220, 0.1, 'square', 0.05);
    else if(kind === 'boost') beep(520, 0.2, 'sine', 0.05);
  }

  function burst(x, y, n, color, spd){
    for(var i = 0; i < n; i++){
      var a = Math.random() * Math.PI * 2, s = (0.4 + Math.random()) * (spd || 90);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, c: color, r: 1.5 + Math.random() * 2 });
    }
    if(particles.length > 260) particles.splice(0, particles.length - 260);
  }
  function pop(x, y, txt, color){
    pops.push({ x: x, y: y, t: 0, txt: txt, c: color || '#7cf59a' });
    if(pops.length > 14) pops.shift();
  }

  /* ---------------- collision ---------------- */
  function buildingAt(x, y, r){
    for(var i = 0; i < buildings.length; i++){
      var b = buildings[i];
      if(x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  }
  function pushOutOfBuildings(ent, r){
    var b = buildingAt(ent.x, ent.y, r);
    if(!b) return null;
    var cx = clamp(ent.x, b.x, b.x + b.w), cy = clamp(ent.y, b.y, b.y + b.h);
    var dx = ent.x - cx, dy = ent.y - cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if(d < 0.001){
      var toL = ent.x - b.x, toR = b.x + b.w - ent.x, toT = ent.y - b.y, toB = b.y + b.h - ent.y;
      var m = Math.min(toL, toR, toT, toB);
      if(m === toL) ent.x = b.x - r; else if(m === toR) ent.x = b.x + b.w + r;
      else if(m === toT) ent.y = b.y - r; else ent.y = b.y + b.h + r;
    } else {
      var push = (r - d) / d;
      ent.x += dx * push; ent.y += dy * push;
    }
    return b;
  }

  function wallBounce(ent, r, rest){
    var hit = false;
    if(ent.x < WORLD_MIN + r){ ent.x = WORLD_MIN + r; ent.vx = Math.abs(ent.vx) * rest; hit = true; }
    if(ent.x > WORLD_MAX - r){ ent.x = WORLD_MAX - r; ent.vx = -Math.abs(ent.vx) * rest; hit = true; }
    if(ent.y < WORLD_MIN + r){ ent.y = WORLD_MIN + r; ent.vy = Math.abs(ent.vy) * rest; hit = true; }
    if(ent.y > WORLD_MAX - r){ ent.y = WORLD_MAX - r; ent.vy = -Math.abs(ent.vy) * rest; hit = true; }
    return hit;
  }

  /* ---------------- missions ---------------- */
  var MISSIONS = [
    { id: 'delivery', name: 'DELIVERY RUSH', tag: 'pickup · drop · clock', reward: 120, limit: 95,
      brief: 'Collect the parcel at Curry Corner and drop it at Neon Tower before the clock dies.' },
    { id: 'checkpoints', name: 'CHECKPOINT SPRINT', tag: '5 rings · in order', reward: 150, limit: 100,
      brief: 'Blast through all 5 neon rings in order. The clock is not on your side.' },
    { id: 'parcels', name: 'PARCEL HUNT', tag: '4 parcels · back to garage', reward: 140, limit: 135,
      brief: 'Grab the 4 parcels hidden around Neon Nagar, then bring yourself back to Rustom Garage.' },
    { id: 'parking', name: 'PRECISION PARKING', tag: 'no clock · park clean', reward: 110, limit: 0,
      brief: 'Drive into the marked bay at the Tape Plaza lot and stand still inside it for 2 seconds.' },
    { id: 'cleanup', name: 'CLEANUP RUN', tag: 'smash 6 crates · garage', reward: 160, limit: 0,
      brief: 'Smash 6 neon crates with your car, then roll back into Rustom Garage.' }
  ];
  function missionById(id){ for(var i = 0; i < MISSIONS.length; i++) if(MISSIONS[i].id === id) return MISSIONS[i]; return MISSIONS[0]; }

  var progress = { coins: 0, done: [], sound: true, best: {} };
  var PROGRESS_KEY = 'neon_nagar_v1';
  function loadProgress(){
    try{
      var raw = localStorage.getItem(PROGRESS_KEY);
      if(raw){
        var p = JSON.parse(raw);
        progress.coins = p.coins || 0;
        progress.done = p.done || [];
        progress.sound = p.sound !== false;
        progress.best = p.best || {};
      }
    }catch(e){}
    audio.on = progress.sound !== false;
  }
  function saveProgress(){
    try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify({ coins: progress.coins, done: progress.done, sound: audio.on, best: progress.best })); }catch(e){}
  }
  function isUnlocked(id){
    var i = 0;
    for(; i < MISSIONS.length; i++) if(MISSIONS[i].id === id) break;
    if(i === 0) return true;
    return progress.done.indexOf(MISSIONS[i - 1].id) > -1;
  }

  var mis = null;
  function setObjective(title, text, frac){
    if(elName) elName.textContent = title;
    if(elObj) elObj.textContent = text;
    if(elProg) elProg.style.width = Math.round(clamp(frac, 0, 1) * 100) + '%';
  }

  function startMission(id){
    hideScreens();
    playing = true; paused = false;
    mis = { id: id, stage: 0, left: 0, done: false, target: null, idx: 0, hold: 0, broke: 0, parcels: [], cps: [], elapsed: 0 };
    var def = missionById(id);
    mis.name = def.name;
    if(id === 'delivery'){
      mis.left = def.limit;
      mis.target = { x: landmarks.shop.x, y: landmarks.shop.y, r: 52, label: 'PICKUP', color: '#ffd166' };
      setObjective('DELIVERY RUSH', 'grab the parcel at curry corner · clock is running', 0);
    } else if(id === 'checkpoints'){
      mis.cps = [
        { x: 1 * PITCH + ROADW / 2, y: 3 * PITCH + ROADW / 2 },
        { x: 4 * PITCH + ROADW / 2, y: 2 * PITCH + ROADW / 2 },
        { x: 6 * PITCH + ROADW / 2, y: 4 * PITCH + ROADW / 2 },
        { x: 3 * PITCH + ROADW / 2, y: 6 * PITCH + ROADW / 2 },
        { x: 0 * PITCH + ROADW / 2, y: 5 * PITCH + ROADW / 2 }
      ];
      mis.left = def.limit;
      setObjective('CHECKPOINT SPRINT', 'ring 1 of 5 — go go go', 0);
      mis.target = { x: mis.cps[0].x, y: mis.cps[0].y, r: 62, label: 'RING 1', color: '#33e0ff' };
    } else if(id === 'parcels'){
      var spots = [[0, 0], [6, 3], [2, 6], [5, 5]];
      mis.parcels = spots.map(function(s, k){
        var b = blockRect(s[0], s[1]);
        var t = 0.28 + 0.44 * (((k * 3) % 4) / 3);
        var side = k % 4;                      /* 0 top, 1 right, 2 bottom, 3 left */
        var x, y;
        if(side === 0){ x = b.x + 54 + t * (b.w - 108); y = b.y + 12; }
        else if(side === 1){ x = b.x + b.w - 12; y = b.y + 54 + t * (b.h - 108); }
        else if(side === 2){ x = b.x + 54 + t * (b.w - 108); y = b.y + b.h - 12; }
        else { x = b.x + 12; y = b.y + 54 + t * (b.h - 108); }
        return { x: x, y: y, taken: false };
      });
      mis.left = def.limit;
      setObjective('PARCEL HUNT', 'parcels 0 / 4', 0);
      mis.target = { x: mis.parcels[0].x, y: mis.parcels[0].y, r: 46, label: 'PARCEL', color: '#b886ff' };
    } else if(id === 'parking'){
      var bay = landmarks.bay;
      mis.target = { x: bay.cx, y: bay.cy, r: 60, label: 'BAY', color: '#7cf59a' };
      setObjective('PRECISION PARKING', 'drive into the bay · hold 2s', 0);
    } else if(id === 'cleanup'){
      mis.crates = crates.slice(0, 6).map(function(c){ c.alive = true; return c; });
      setObjective('CLEANUP RUN', 'crates 0 / 6 — hit them with the car', 0);
      mis.target = null;
    }
    updateMissionTarget();
    syncHud();
  }

  function endMission(win, reason){
    if(!mis || mis.done) return;
    mis.done = true;
    playing = false;
    var def = missionById(mis.id);
    if(win){
      if(progress.done.indexOf(mis.id) < 0) progress.done.push(mis.id);
      progress.coins += def.reward;
      var tNow = Math.round(mis.elapsed * 10) / 10;
      if(!progress.best[mis.id] || tNow < progress.best[mis.id]) progress.best[mis.id] = tNow;
      saveProgress();
      sfx('win');
      showModal(true, def, reason);
    } else {
      sfx('fail');
      showModal(false, def, reason);
    }
    syncHud();
  }

  function updateMissionTarget(){
    if(!mis) return;
    if(mis.id === 'delivery'){
      if(mis.stage === 0) mis.target = { x: landmarks.shop.x, y: landmarks.shop.y, r: 52, label: 'PICKUP', color: '#ffd166' };
      else mis.target = { x: landmarks.tower.x, y: landmarks.tower.y, r: 54, label: 'DROP', color: '#33e0ff' };
    } else if(mis.id === 'checkpoints'){
      var cp = mis.cps[mis.idx];
      mis.target = cp ? { x: cp.x, y: cp.y, r: 62, label: 'RING ' + (mis.idx + 1), color: '#33e0ff' } : null;
    } else if(mis.id === 'parcels'){
      var left = mis.parcels.filter(function(p){ return !p.taken; });
      if(left.length){
        var best = left[0], bd = 1e9;
        for(var i = 0; i < left.length; i++){
          var d = dist(player.inCar ? car.x : player.x, player.inCar ? car.y : player.y, left[i].x, left[i].y);
          if(d < bd){ bd = d; best = left[i]; }
        }
        mis.target = { x: best.x, y: best.y, r: 46, label: 'PARCEL', color: '#b886ff' };
      } else {
        mis.target = { x: landmarks.garage.x, y: landmarks.garage.y, r: 60, label: 'GARAGE', color: '#7cf59a' };
      }
    } else if(mis.id === 'cleanup'){
      var alive = mis.crates.filter(function(c){ return c.alive; });
      if(alive.length){
        var b2 = alive[0], bd2 = 1e9;
        for(var j = 0; j < alive.length; j++){
          var d2 = dist(car.x, car.y, alive[j].x, alive[j].y);
          if(d2 < bd2){ bd2 = d2; b2 = alive[j]; }
        }
        mis.target = { x: b2.x, y: b2.y, r: 40, label: 'CRATE', color: '#ff9f45' };
      } else {
        mis.target = { x: landmarks.garage.x, y: landmarks.garage.y, r: 60, label: 'GARAGE', color: '#7cf59a' };
      }
    }
  }

  function tickMission(dt){
    if(!mis || mis.done) return;
    var px = player.inCar ? car.x : player.x, py = player.inCar ? car.y : player.y;
    mis.elapsed += dt;
    if(mis.left > 0){
      mis.left -= dt;
      if(mis.left <= 0){ mis.left = 0; endMission(false, 'out of time.'); return; }
    }
    var t = mis.target;
    if(mis.id === 'delivery'){
      if(t && dist(px, py, t.x, t.y) < t.r){
        if(mis.stage === 0){
          mis.stage = 1;
          sfx('pick'); pop(t.x, t.y, 'parcel in hand', '#ffd166');
          setObjective('DELIVERY RUSH', 'drop it at neon tower before the clock dies', 0.5);
          updateMissionTarget();
        } else {
          setObjective('DELIVERY RUSH', 'delivered', 1);
          endMission(true, 'parcel delivered · +' + missionById('delivery').reward);
        }
      }
    } else if(mis.id === 'checkpoints'){
      if(t && dist(px, py, t.x, t.y) < t.r){
        sfx('coin'); burst(t.x, t.y, 12, '#33e0ff', 110);
        mis.idx++;
        if(mis.idx >= mis.cps.length){
          setObjective('CHECKPOINT SPRINT', 'all rings cleared', 1);
          endMission(true, 'all 5 rings · +' + missionById('checkpoints').reward);
        } else {
          setObjective('CHECKPOINT SPRINT', 'ring ' + (mis.idx + 1) + ' of 5', mis.idx / 5);
          updateMissionTarget();
        }
      }
    } else if(mis.id === 'parcels'){
      var got = 0;
      for(var i = 0; i < mis.parcels.length; i++){
        var p = mis.parcels[i];
        if(p.taken){ got++; continue; }
        if(dist(px, py, p.x, p.y) < 44){
          p.taken = true; got++; sfx('pick'); burst(p.x, p.y, 10, '#b886ff', 90);
          setObjective('PARCEL HUNT', got >= 4 ? 'all parcels — back to the garage' : 'parcels ' + got + ' / 4', got / 5);
          updateMissionTarget();
        }
      }
      if(got >= 4 && t && t.label === 'GARAGE' && dist(px, py, t.x, t.y) < t.r){
        endMission(true, 'all parcels home · +' + missionById('parcels').reward);
      }
    } else if(mis.id === 'parking'){
      var bay = landmarks.bay;
      var inside = player.inCar && car.x > bay.x && car.x < bay.x + bay.w && car.y > bay.y && car.y < bay.y + bay.h;
      var slow = Math.sqrt(car.vx * car.vx + car.vy * car.vy) < 16;
      if(inside && slow){
        mis.hold += dt;
        setObjective('PRECISION PARKING', 'hold it… ' + Math.max(0, (2 - mis.hold)).toFixed(1) + 's', mis.hold / 2);
        if(mis.hold >= 2) endMission(true, 'parked clean · +' + missionById('parking').reward);
      } else {
        if(mis.hold > 0) mis.hold = Math.max(0, mis.hold - dt * 0.6);
        setObjective('PRECISION PARKING', inside ? 'slow down and stop inside the bay' : 'drive into the marked bay', mis.hold / 2);
      }
    } else if(mis.id === 'cleanup'){
      var aliveN = 0;
      for(var c = 0; c < mis.crates.length; c++) if(mis.crates[c].alive) aliveN++;
      var broken = mis.crates.length - aliveN;
      if(broken !== mis.broke){ mis.broke = broken; updateMissionTarget(); }
      if(aliveN === 0 && t && dist(px, py, t.x, t.y) < t.r){
        endMission(true, 'street cleaned · +' + missionById('cleanup').reward);
      }
      setObjective('CLEANUP RUN', aliveN ? 'crates ' + broken + ' / 6 — hit them with the car' : 'all crates smashed — back to the garage', broken / 7);
    }
  }

  /* ---------------- updates ---------------- */
  var GRAV = 0;

  function inputVector(){
    var ix = 0, iy = 0;
    if(keys['a'] || keys['arrowleft']) ix -= 1;
    if(keys['d'] || keys['arrowright']) ix += 1;
    if(keys['w'] || keys['arrowup']) iy -= 1;
    if(keys['s'] || keys['arrowdown']) iy += 1;
    if(stick.active){ ix += stick.dx; iy += stick.dy; }
    var m = Math.sqrt(ix * ix + iy * iy);
    if(m > 1){ ix /= m; iy /= m; }
    return { x: ix, y: iy, m: Math.min(1, m) };
  }

  function nearCar(){
    return dist(player.x, player.y, car.x, car.y) < 74;
  }

  function enterCar(){
    if(player.inCar) return;
    if(!nearCar()) return;
    player.inCar = true;
    car.vx = 0; car.vy = 0;
    sfx('pick');
    pop(car.x, car.y - 26, 'engine on', '#7cf59a');
  }
  function exitCar(){
    if(!player.inCar) return;
    player.inCar = false;
    var a = car.ang + Math.PI / 2;
    player.x = car.x + Math.cos(a) * 34;
    player.y = car.y + Math.sin(a) * 34;
    player.vx = 0; player.vy = 0;
    player.ang = a;
    car.vx *= 0.2; car.vy *= 0.2;
    pushOutOfBuildings(player, player.r);
    sfx('pick');
  }

  function updatePlayer(dt){
    var v = inputVector();
    var run = keys['shift'] || v.m > 0.86;
    var speed = run ? 196 : 112;
    if(player.dash > 0){
      player.dash -= dt;
      speed *= 1.9;
    }
    player.vx = lerp(player.vx, v.x * speed, 1 - Math.pow(0.0001, dt));
    player.vy = lerp(player.vy, v.y * speed, 1 - Math.pow(0.0001, dt));
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if(v.m > 0.1) player.ang = Math.atan2(player.vy, player.vx);
    player.walk += Math.sqrt(player.vx * player.vx + player.vy * player.vy) * dt * 0.08;
    if(pushOutOfBuildings(player, player.r)){ player.vx *= -0.2; player.vy *= -0.2; }
    wallBounce(player, player.r, 0);
    if(keys.brake && player.dash <= 0){ player.dash = 0.24; sfx('boost'); }
    if(btn.enterEdge){ btn.enterEdge = false; if(nearCar()) enterCar(); }
  }

  var CAR_ACC = 520, CAR_MAX = 330, CAR_REV = 130, CAR_TURN = 3.05;

  function updateCar(dt){
    var v = inputVector();
    var throttle = 0, steer = 0;
    if(keys['w'] || keys['arrowup']) throttle += 1;
    if(keys['s'] || keys['arrowdown']) throttle -= 1;
    if(keys['a'] || keys['arrowleft']) steer -= 1;
    if(keys['d'] || keys['arrowright']) steer += 1;
    if(stick.active){
      throttle += -stick.dy;
      steer += stick.dx;
    }
    throttle = clamp(throttle, -1, 1);
    steer = clamp(steer, -1, 1);

    var handbrake = keys.brake || btn.drift;

    /* nitro */
    var wantBoost = (keys['n'] || btn.boost) && car.nitro > 0.02;
    if(wantBoost){
      car.boost = 1.6;
      car.nitro = Math.max(0, car.nitro - dt * 0.42);
      if(Math.random() < 0.25) burst(car.x - Math.cos(car.ang) * 24, car.y - Math.sin(car.ang) * 24, 1, '#33e0ff', 60);
    } else {
      car.nitro = Math.min(1, car.nitro + dt * 0.12);
    }
    if(car.boost > 0) car.boost -= dt;

    var fx = Math.cos(car.ang), fy = Math.sin(car.ang);
    var vLong = car.vx * fx + car.vy * fy;
    var vLat = -car.vx * fy + car.vy * fx;

    var accel = CAR_ACC * (car.boost > 0 ? 1.75 : 1);
    if(throttle > 0) vLong += accel * throttle * dt;
    else if(throttle < 0){
      if(vLong > 8) vLong -= 900 * dt;        /* braking */
      else vLong += accel * 0.55 * throttle * dt;  /* reverse */
    }
    if(handbrake) vLong *= 1 - 1.9 * dt;
    vLong *= 1 - 0.55 * dt;
    vLong = clamp(vLong, -CAR_REV, CAR_MAX * (car.boost > 0 ? 1.32 : 1));

    var grip = handbrake ? 1.1 : 7.4;
    vLat *= Math.max(0, 1 - grip * dt);

    var speedFactor = clamp(Math.abs(vLong) / 120, 0, 1);
    /* arcade assist: you can always pivot when the wheels are nearly stopped (no dead corners) */
    if(speedFactor < 0.5 && (throttle !== 0 || Math.abs(vLong) < 40)) speedFactor = 0.5;
    car.ang += steer * CAR_TURN * dt * speedFactor * (vLong < -2 ? -1 : 1);

    fx = Math.cos(car.ang); fy = Math.sin(car.ang);
    car.vx = fx * vLong - fy * vLat;
    car.vy = fy * vLong + fx * vLat;
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    /* skid marks + tyre smoke */
    var speedNow = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    if(Math.abs(vLat) > 44 && speedNow > 60){
      skids.push({ x: car.x - fx * 16, y: car.y - fy * 16, a: car.ang, t: 0 });
      if(skids.length > 200) skids.shift();
      if(Math.random() < 0.4) burst(car.x - fx * 18, car.y - fy * 18, 1, 'rgba(200,210,230,0.5)', 30);
      car.skid = 1;
    } else car.skid = Math.max(0, car.skid - dt * 2);

    /* building collisions */
    var hit = pushOutOfBuildings(car, 20);
    if(hit){
      var sp = speedNow;
      /* bounce off the normal, keep some speed along the wall so you slide instead of sticking */
      var nxc = clamp(car.x, hit.x, hit.x + hit.w), nyc = clamp(car.y, hit.y, hit.y + hit.h);
      var ndx = car.x - nxc, ndy = car.y - nyc;
      var nl = Math.sqrt(ndx * ndx + ndy * ndy);
      if(nl < 0.001){ ndx = 0; ndy = -1; nl = 1; }
      ndx /= nl; ndy /= nl;
      var vn = car.vx * ndx + car.vy * ndy;
      if(vn < 0){
        car.vx -= vn * ndx * (sp > 60 ? 1.42 : 1.15);
        car.vy -= vn * ndy * (sp > 60 ? 1.42 : 1.15);
      }
      car.vx *= 0.82; car.vy *= 0.82;
      if(sp > 60){
        cam.shake = Math.min(14, sp / 22);
        burst(car.x, car.y, 10, '#ffd166', 130);
        sfx('crash');
        beepOnce();
      }
    }
    if(wallBounce(car, 20, 0.3)){ cam.shake = Math.min(10, speedNow / 26); }

    /* traffic collisions */
    for(var i = 0; i < traffic.length; i++){
      var t = traffic[i], tp = trafficPos(t);
      if(dist(car.x, car.y, tp.x, tp.y) < 36){
        var ang = Math.atan2(car.y - tp.y, car.x - tp.x);
        car.x += Math.cos(ang) * 3; car.y += Math.sin(ang) * 3;
        car.vx = car.vx * -0.25 - Math.cos(ang) * 60;
        car.vy = car.vy * -0.25 - Math.sin(ang) * 60;
        cam.shake = 9;
        burst(car.x, car.y, 8, '#ff8f6b', 120);
        sfx('crash');
      }
    }

    /* crates */
    if(speedNow > 85){
      for(var c = 0; c < crates.length; c++){
        var cr = crates[c];
        if(cr.alive && dist(car.x, car.y, cr.x, cr.y) < 34){
          cr.alive = false;
          burst(cr.x, cr.y, 16, ['#ff9f45', '#ffd166', '#33e0ff'][cr.hue], 150);
          pop(cr.x, cr.y, '+crate', '#ff9f45');
          cam.shake = 7;
          sfx('smash');
        }
      }
    }

    if(btn.enterEdge){
      btn.enterEdge = false;
      if(speedNow < 110) exitCar();
      else toast('slow down to get out');
    }
  }
  var lastBeep = 0;
  function beepOnce(){
    var now = performance.now();
    if(now - lastBeep < 260) return;
    lastBeep = now;
  }

  function updateTraffic(dt){
    for(var i = 0; i < traffic.length; i++){
      var t = traffic[i];
      t.pos += t.speed * t.dir * dt;
      if(t.pos > WORLD - 60){ t.pos = 60; }
      if(t.pos < 60){ t.pos = WORLD - 60; }
    }
  }

  function updateEffects(dt){
    for(var i = particles.length - 1; i >= 0; i--){
      var p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 2.6 * dt; p.vy *= 1 - 2.6 * dt;
      p.life -= dt;
      if(p.life <= 0) particles.splice(i, 1);
    }
    for(var s = skids.length - 1; s >= 0; s--){
      skids[s].t += dt;
      if(skids[s].t > 7) skids.splice(s, 1);
    }
    for(var q = pops.length - 1; q >= 0; q--){
      pops[q].t += dt;
      if(pops[q].t > 1.1) pops.splice(q, 1);
    }
    if(cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 26);
  }

  function updateCamera(dt){
    var tx = player.inCar ? car.x : player.x;
    var ty = player.inCar ? car.y : player.y;
    var vw = W / cam.zoom, vh = H / cam.zoom;
    var wantX = tx - vw / 2, wantY = ty - vh / 2;
    wantX = clamp(wantX, 0, Math.max(0, WORLD - vw));
    wantY = clamp(wantY, 0, Math.max(0, WORLD - vh));
    var k = 1 - Math.pow(0.0015, dt);
    cam.x = lerp(cam.x, wantX, k);
    cam.y = lerp(cam.y, wantY, k);
    cam.sx = (Math.random() - 0.5) * cam.shake;
    cam.sy = (Math.random() - 0.5) * cam.shake;
  }

  /* ---------------- drawing ---------------- */
  function visible(){
    var vw = W / cam.zoom, vh = H / cam.zoom;
    return { x0: cam.x - 80, y0: cam.y - 80, x1: cam.x + vw + 80, y1: cam.y + vh + 80 };
  }
  function inView(v, x, y, w, h){
    return x < v.x1 && x + w > v.x0 && y < v.y1 && y + h > v.y0;
  }

  function drawGround(v){
    /* asphalt */
    ctx.fillStyle = '#8e8a80';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.fillStyle = '#41403f';
    for(var i = 0; i <= GRID; i++){
      var p = i * PITCH;
      if(p > v.y1 || p + ROADW < v.y0) continue;
      ctx.fillRect(v.x0, p, v.x1 - v.x0, ROADW);
    }
    for(var j = 0; j <= GRID; j++){
      var q = j * PITCH;
      if(q > v.x1 || q + ROADW < v.x0) continue;
      ctx.fillRect(q, v.y0, ROADW, v.y1 - v.y0);
    }
    /* lane dashes */
    ctx.strokeStyle = 'rgba(240,238,230,0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 26]);
    for(var a = 0; a <= GRID; a++){
      var y = a * PITCH + ROADW / 2;
      if(y < v.y0 - 40 || y > v.y1 + 40) continue;
      ctx.beginPath(); ctx.moveTo(v.x0, y); ctx.lineTo(v.x1, y); ctx.stroke();
    }
    for(var b = 0; b <= GRID; b++){
      var x = b * PITCH + ROADW / 2;
      if(x < v.x0 - 40 || x > v.x1 + 40) continue;
      ctx.beginPath(); ctx.moveTo(x, v.y0); ctx.lineTo(x, v.y1); ctx.stroke();
    }
    ctx.setLineDash([]);

    /* blocks: sidewalk plate */
    for(var bj = 0; bj < GRID; bj++){
      for(var bi = 0; bi < GRID; bi++){
        var r = blockRect(bi, bj);
        if(!inView(v, r.x, r.y, r.w, r.h)) continue;
        ctx.fillStyle = '#9c988c';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        /* kerb */
        ctx.strokeStyle = 'rgba(200,195,182,0.75)';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        ctx.strokeStyle = 'rgba(120,116,104,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16);
      }
    }
    /* crosswalk hints at intersections */
    ctx.fillStyle = 'rgba(240,240,235,0.45)';
    for(var cj = 0; cj <= GRID; cj++){
      for(var ci = 0; ci <= GRID; ci++){
        var cx = ci * PITCH, cy = cj * PITCH;
        if(cx > v.x1 || cx + ROADW < v.x0 || cy > v.y1 || cy + ROADW < v.y0) continue;
        for(var s = 0; s < 4; s++){
          ctx.fillRect(cx + 8 + s * 22, cy - 14, 12, 10);
          ctx.fillRect(cx + 8 + s * 22, cy + ROADW + 4, 12, 10);
          ctx.fillRect(cx - 14, cy + 8 + s * 22, 10, 12);
          ctx.fillRect(cx + ROADW + 4, cy + 8 + s * 22, 10, 12);
        }
      }
    }
    /* parks */
    for(var pi = 0; pi < parks.length; pi++){
      var pk = parks[pi];
      if(!inView(v, pk.x, pk.y, pk.w, pk.h)) continue;
      ctx.fillStyle = '#13251c';
      rrect(ctx, pk.x, pk.y, pk.w, pk.h, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(120,255,180,0.16)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(120,255,180,0.05)';
      ctx.beginPath(); ctx.arc(pk.x + pk.w / 2, pk.y + pk.h / 2, pk.w * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    /* painted lots */
    for(var pp = 0; pp < props.length; pp++){
      var pr = props[pp];
      if(pr.type !== 'paint') continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.setLineDash([10, 12]); ctx.lineWidth = 2;
      ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);
      ctx.setLineDash([]);
    }
    /* parking bay highlight */
    if(landmarks.bay){
      var bay = landmarks.bay;
      ctx.save();
      ctx.strokeStyle = 'rgba(124,245,154,0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.strokeRect(bay.x, bay.y, bay.w, bay.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(124,245,154,0.07)';
      ctx.fillRect(bay.x, bay.y, bay.w, bay.h);
      ctx.restore();
    }
  }

  function drawBuildingRoofExtras(b){
    /* rooftop clutter */
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    var s = Math.min(b.w, b.h);
    if(s > 90){
      rrect(ctx, b.x + b.w * 0.16, b.y + b.h * 0.2, 20, 14, 3); ctx.fill();
      rrect(ctx, b.x + b.w * 0.6, b.y + b.h * 0.62, 16, 16, 4); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x + b.w * 0.78, b.y + b.h * 0.26, 9, 0, Math.PI * 2); ctx.fill();
    }
    /* landmark name painted on the roof */
    if(b.label && b.w > 130 && b.h > 70){
      var fs = Math.min(17, Math.max(11, b.w / 12));
      ctx.save();
      ctx.font = '700 ' + fs.toFixed(1) + 'px JBMonoEmbed, ui-monospace, monospace';
      var tw = ctx.measureText(b.label).width;
      if(tw > b.w - 22){
        fs = Math.max(9, fs * (b.w - 22) / tw);
        ctx.font = '700 ' + fs.toFixed(1) + 'px JBMonoEmbed, ui-monospace, monospace';
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = b.labelColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = b.labelColor;
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h * 0.52);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.52 + fs * 0.72, b.w * 0.6, 2);
      ctx.restore();
    }
  }

  function drawBuilding(b){
    var hgt = b.hgt;
    /* ground shadow, cast down-right */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    rrect(ctx, b.x + 8, b.y + 10, b.w, b.h + hgt, 7); ctx.fill();

    /* south wall (extrusion) */
    if(!b._sg){
      b._sg = ctx.createLinearGradient(0, b.y + b.h, 0, b.y + b.h + hgt);
      b._sg.addColorStop(0, b.wallA);
      b._sg.addColorStop(1, b.wallB);
    }
    ctx.fillStyle = b._sg;
    ctx.fillRect(b.x, b.y + b.h, b.w, hgt);

    /* east wall sliver */
    ctx.fillStyle = b.wallB;
    ctx.fillRect(b.x + b.w, b.y + 4, 6, b.h + hgt - 4);

    /* lit window grid on the south wall */
    if(b.lit && b.w > 96){
      var cols = Math.max(2, Math.floor(b.w / 30));
      var wwid = Math.max(6, (b.w - 20) / cols - 6);
      for(var i = 0; i < cols; i++){
        if(((i * 5 + b.winRow * 3) % 6) === 0) continue;
        ctx.fillStyle = b.neon === '#ffd166' ? 'rgba(255,209,102,0.92)' : 'rgba(150,225,255,0.8)';
        ctx.fillRect(b.x + 12 + i * (b.w - 20) / cols, b.y + b.h + Math.max(4, hgt * 0.26), wwid, Math.max(4, hgt * 0.3));
      }
    }
    /* neon sign strip on the wall */
    if(b.sign && b.w > 110){
      ctx.save();
      ctx.shadowColor = b.neon; ctx.shadowBlur = 16;
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + 16, b.y + b.h + Math.max(2, hgt * 0.72), Math.min(b.w - 32, 70), 4);
      ctx.restore();
    }

    /* roof */
    if(!b._rg){
      b._rg = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      b._rg.addColorStop(0, b.roofA);
      b._rg.addColorStop(1, b.roofB);
    }
    ctx.fillStyle = b._rg;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    /* roof highlight + edge */
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x, b.y, b.w, 3);
    ctx.strokeStyle = 'rgba(170,215,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    drawBuildingRoofExtras(b);
  }

  function drawTree(t){
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d3a2a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,220,150,0.35)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }

  function drawPed(p){
    var bob = Math.sin(performance.now() / 180 + p.pos * 0.12) * 0.9;
    var lift = p.hop * 2.8;
    ctx.save();
    /* shadow */
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.arc(p.x, p.y + 3.5, 5.4, 0, Math.PI * 2); ctx.fill();
    /* body */
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(4,10,8,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(p.x, p.y - lift + bob * 0.35, 5.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    /* head */
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.beginPath(); ctx.arc(p.x, p.y - 5.4 - lift + bob * 0.35, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCrate(c){
    var col = ['#ff9f45', '#ffd166', '#33e0ff'][c.hue];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rrect(ctx, c.x - c.r + 3, c.y - c.r + 4, c.r * 2, c.r * 2, 4); ctx.fill();
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(20,26,34,0.96)';
    rrect(ctx, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2, 4); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    rrect(ctx, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x - c.r + 3, c.y - c.r + 3); ctx.lineTo(c.x + c.r - 3, c.y + c.r - 3); ctx.stroke();
    ctx.restore();
  }

  var lampGrad = null;
  function drawLamp(l){
    ctx.save();
    var g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 74);
    g.addColorStop(0, 'rgba(255,214,140,0.30)');
    g.addColorStop(0.45, 'rgba(255,190,120,0.10)');
    g.addColorStop(1, 'rgba(255,180,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(l.x, l.y, 74, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath(); ctx.arc(l.x, l.y, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCarShape(x, y, ang, w, h, color, isPlayer){
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    rrect(ctx, -w / 2 + 3, -h / 2 + 4, w, h, 7); ctx.fill();
    var g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    rrect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6;
    rrect(ctx, -w / 2, -h / 2, w, h, 7); ctx.stroke();
    /* cabin */
    ctx.fillStyle = 'rgba(12,20,30,0.85)';
    rrect(ctx, -w * 0.14, -h / 2 + 3, w * 0.42, h - 6, 4); ctx.fill();
    ctx.fillStyle = 'rgba(130,200,255,0.35)';
    rrect(ctx, -w * 0.10, -h / 2 + 4, w * 0.16, h - 8, 3); ctx.fill();
    /* lights */
    ctx.fillStyle = isPlayer ? '#d9ffe9' : 'rgba(255,255,220,0.85)';
    ctx.fillRect(w / 2 - 4, -h / 2 + 3, 4, 4);
    ctx.fillRect(w / 2 - 4, h / 2 - 7, 4, 4);
    ctx.fillStyle = 'rgba(255,80,90,0.9)';
    ctx.fillRect(-w / 2 + 1, -h / 2 + 3, 3, 4);
    ctx.fillRect(-w / 2 + 1, h / 2 - 7, 3, 4);
    ctx.restore();
  }

  function drawPlayerChar(p){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 5, p.r + 2, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    var bob = Math.sin(p.walk * 3.2) * 1.6;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,26,34,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, p.r, 0, Math.PI * 2); ctx.stroke();
    /* facing marker */
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.ang) * 4, p.y + bob + Math.sin(p.ang) * 4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMarker(m, tsec){
    var pulse = 1 + Math.sin(tsec * 3.4) * 0.09;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, m.r * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(0, 0, m.r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(0, -m.r * 0.42); ctx.lineTo(9, 0); ctx.lineTo(0, 6); ctx.lineTo(-9, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function draw2D(){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var v = visible();
    ctx.save();
    ctx.translate(-cam.x * cam.zoom + cam.sx, -cam.y * cam.zoom + cam.sy);
    ctx.scale(cam.zoom, cam.zoom);

    drawGround(v);

    /* skid marks */
    ctx.save();
    for(var s = 0; s < skids.length; s++){
      var sk = skids[s];
      if(!inView(v, sk.x - 10, sk.y - 10, 20, 20)) continue;
      ctx.globalAlpha = Math.max(0, 0.55 * (1 - sk.t / 9));
      ctx.fillStyle = '#04060a';
      ctx.save();
      ctx.translate(sk.x, sk.y); ctx.rotate(sk.a);
      ctx.fillRect(-6, -6, 12, 11);
      ctx.restore();
    }
    ctx.restore();

    /* lamps (ground glow) */
    for(var l = 0; l < lamps.length; l++){
      var lm = lamps[l];
      if(!inView(v, lm.x - 60, lm.y - 60, 120, 120)) continue;
      drawLamp(lm);
    }

    /* buildings sorted by y for a 2.5D stack */
    var vis = [];
    for(var i = 0; i < buildings.length; i++){
      var b = buildings[i];
      if(inView(v, b.x, b.y, b.w, b.h + b.hgt)) vis.push(b);
    }
    vis.sort(function(a, b2){ return (a.y + a.h) - (b2.y + b2.h); });
    for(var k = 0; k < vis.length; k++) drawBuilding(vis[k]);

    /* trees */
    for(var t = 0; t < trees.length; t++){
      var tr = trees[t];
      if(!inView(v, tr.x - tr.r, tr.y - tr.r, tr.r * 2, tr.r * 2)) continue;
      drawTree(tr);
    }

    /* crates */
    for(var c = 0; c < crates.length; c++){
      var cr = crates[c];
      if(!cr.alive || !inView(v, cr.x - 20, cr.y - 20, 40, 40)) continue;
      drawCrate(cr);
    }

    /* pedestrians strolling the sidewalks */
    for(var pdi = 0; pdi < peds.length; pdi++){
      var pe = peds[pdi];
      if(pe.x < v.x0 - 20 || pe.x > v.x1 + 20 || pe.y < v.y0 - 20 || pe.y > v.y1 + 20) continue;
      drawPed(pe);
    }

    /* mission markers under entities */
    if(mis && mis.target && !mis.done) drawMarker(mis.target, performance.now() / 1000);
    if(mis && mis.id === 'checkpoints'){
      for(var ci = 0; ci < mis.cps.length; ci++){
        if(ci === mis.idx) continue;
        var cp = mis.cps[ci];
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#33e0ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cp.x, cp.y, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    if(mis && mis.id === 'parcels'){
      for(var pi2 = 0; pi2 < mis.parcels.length; pi2++){
        var pa = mis.parcels[pi2];
        if(pa.taken) continue;
        ctx.save();
        ctx.shadowColor = '#b886ff'; ctx.shadowBlur = 14;
        ctx.fillStyle = '#b886ff';
        rrect(ctx, pa.x - 9, pa.y - 9, 18, 18, 4); ctx.fill();
        ctx.restore();
      }
    }

    /* traffic */
    for(var tt = 0; tt < traffic.length; tt++){
      var tc = traffic[tt], tp = trafficPos(tc);
      if(!inView(v, tp.x - 30, tp.y - 30, 60, 60)) continue;
      drawCarShape(tp.x, tp.y, tc.ang, tc.w, tc.h, tc.color, false);
    }

    /* player car + player */
    if(!player.inCar) drawCarShape(car.x, car.y, car.ang, car.w, car.h, '#4ade80', true);
    else drawCarShape(car.x, car.y, car.ang, car.w, car.h, '#4ade80', true);
    if(!player.inCar) drawPlayerChar(player);

    /* nitro flame */
    if(car.boost > 0 && player.inCar){
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.random() * 0.3;
      ctx.fillStyle = '#33e0ff';
      ctx.beginPath();
      var bx = car.x - Math.cos(car.ang) * 26, by = car.y - Math.sin(car.ang) * 26;
      ctx.arc(bx, by, 7 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* particles */
    for(var pp2 = 0; pp2 < particles.length; pp2++){
      var p = particles[pp2];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* floating pops */
    for(var q = 0; q < pops.length; q++){
      var popi = pops[q];
      ctx.globalAlpha = Math.max(0, 1 - popi.t / 1.1);
      ctx.fillStyle = popi.c;
      ctx.font = '600 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(popi.txt, popi.x, popi.y - popi.t * 26);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    /* on-foot car hint */
    if(!player.inCar && nearCar() && !mis || (!player.inCar && nearCar())){
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('E · drive', car.x, car.y - 26);
      ctx.restore();
    }
    ctx.restore();

    /* screen space: arrow that points at an off-screen objective */
    if(mis && mis.target && !mis.done && playing){
      var tx = mis.target.x * cam.zoom - cam.x * cam.zoom + cam.sx;
      var ty = mis.target.y * cam.zoom - cam.y * cam.zoom + cam.sy;
      var pad2 = 58;
      if(tx < pad2 || ty < pad2 || tx > W - pad2 || ty > H - pad2){
        var acx = W / 2, acy = H / 2;
        var aang = Math.atan2(ty - acy, tx - acx);
        var ca = Math.cos(aang), sa = Math.sin(aang);
        var lim = Math.min((W / 2 - pad2) / Math.max(0.0001, Math.abs(ca)), (H / 2 - pad2) / Math.max(0.0001, Math.abs(sa)));
        var axd = acx + ca * lim, ayd = acy + sa * lim;
        var wpx = player.inCar ? car.x : player.x, wpy = player.inCar ? car.y : player.y;
        ctx.save();
        ctx.translate(axd, ayd);
        ctx.rotate(aang);
        ctx.fillStyle = mis.target.color || '#33e0ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-9, -9); ctx.lineTo(-3, 0); ctx.lineTo(-9, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = 'rgba(226,244,255,0.9)';
        ctx.font = '600 11px JBMonoEmbed, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(dist(wpx, wpy, mis.target.x, mis.target.y) / 10) + 'm', axd, ayd + 26);
        ctx.restore();
      }
    }

    /* screen space: vignette */
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,4,8,0.62)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------------- minimap ---------------- */
  var miniTick = 0, hudTick = 0;
  function drawMini(){
    if(!miniEl) return;
    var s = miniEl.width;
    var k = s / WORLD;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, s, s);
    mctx.fillStyle = 'rgba(7,11,17,0.94)';
    mctx.fillRect(0, 0, s, s);
    mctx.fillStyle = 'rgba(70,94,126,0.6)';
    for(var i = 0; i <= GRID; i++){
      mctx.fillRect(0, i * PITCH * k, s, Math.max(1.5, ROADW * k));
      mctx.fillRect(i * PITCH * k, 0, Math.max(1.5, ROADW * k), s);
    }
    mctx.fillStyle = 'rgba(120,175,225,0.26)';
    for(var b = 0; b < buildings.length; b++){
      var bd = buildings[b];
      mctx.fillRect(bd.x * k, bd.y * k, Math.max(1, bd.w * k), Math.max(1, bd.h * k));
    }
    /* landmarks */
    mctx.fillStyle = '#7cf59a';
    mctx.fillRect(landmarks.garage.x * k - 2, landmarks.garage.y * k - 2, 4, 4);
    if(landmarks.bay){
      mctx.fillStyle = 'rgba(124,245,154,0.6)';
      mctx.fillRect(landmarks.bay.x * k, landmarks.bay.y * k, Math.max(2, landmarks.bay.w * k), Math.max(2, landmarks.bay.h * k));
    }
    /* mission stuff */
    if(mis && !mis.done){
      if(mis.parcels){
        for(var p = 0; p < mis.parcels.length; p++){
          if(mis.parcels[p].taken) continue;
          mctx.fillStyle = '#b886ff';
          mctx.fillRect(mis.parcels[p].x * k - 1.5, mis.parcels[p].y * k - 1.5, 3, 3);
        }
      }
      if(mis.cps){
        for(var c = 0; c < mis.cps.length; c++){
          mctx.strokeStyle = 'rgba(51,224,255,0.65)';
          mctx.lineWidth = 1;
          mctx.beginPath(); mctx.arc(mis.cps[c].x * k, mis.cps[c].y * k, 2.6, 0, Math.PI * 2); mctx.stroke();
        }
      }
      if(mis.target){
        mctx.fillStyle = mis.target.color;
        mctx.beginPath(); mctx.arc(mis.target.x * k, mis.target.y * k, 3.4, 0, Math.PI * 2); mctx.fill();
      }
    }
    /* traffic */
    mctx.fillStyle = 'rgba(255,180,120,0.6)';
    for(var t = 0; t < traffic.length; t++){
      var tp = trafficPos(traffic[t]);
      mctx.fillRect(tp.x * k - 1, tp.y * k - 1, 2, 2);
    }
    /* player */
    var px = (player.inCar ? car.x : player.x) * k, py = (player.inCar ? car.y : player.y) * k;
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(player.inCar ? car.ang : player.ang);
    mctx.fillStyle = '#eafff2';
    mctx.beginPath(); mctx.moveTo(4.6, 0); mctx.lineTo(-3, 3); mctx.lineTo(-3, -3); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  /* ---------------- hud ---------------- */
  function syncHud(){
    if(elCoins) elCoins.textContent = progress.coins;
    if(elTimer){
      if(mis && mis.left > 0){
        elTimer.hidden = false;
        var s = Math.ceil(mis.left);
        elTimer.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
        if(s < 16) elTimer.classList.add('is-low'); else elTimer.classList.remove('is-low');
      } else {
        elTimer.hidden = true;
      }
    }
    var speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    if(elSpeed) elSpeed.textContent = player.inCar ? Math.round(speed * 0.42) : 0;
    if(elNitro) elNitro.style.width = Math.round(car.nitro * 100) + '%';
    if(elPad) elPad.classList.toggle('is-driving', player.inCar);
  }

  /* ---------------- screens ---------------- */
  function showScreen(which){
    if(uiStart) uiStart.hidden = which !== 'start';
    if(uiPause) uiPause.hidden = which !== 'pause';
    if(uiModal) uiModal.hidden = which !== 'modal';
    if(which) layer.setAttribute('data-screen', which); else layer.removeAttribute('data-screen');
  }
  function hideScreens(){ showScreen(null); }

  function renderStart(){
    var wrap = el('cityMissions');
    if(!wrap) return;
    var html = '';
    for(var i = 0; i < MISSIONS.length; i++){
      var m = MISSIONS[i];
      var open = isUnlocked(m.id);
      var done = progress.done.indexOf(m.id) > -1;
      html += '<button class="nn-mis' + (open ? '' : ' is-locked') + (done ? ' is-done' : '') + '" type="button" data-mission="' + m.id + '"' + (open ? '' : ' disabled') + '>'
        + '<span class="nn-mis__no">0' + (i + 1) + '</span>'
        + '<span class="nn-mis__t"><b>' + m.name + '</b><span>' + m.brief + '</span></span>'
        + '<span class="nn-mis__r">' + (done ? 'DONE' : (open ? '◈' + m.reward : 'LOCKED'))
        + (progress.best[m.id] ? '<i class="nn-mis__best">best ' + progress.best[m.id].toFixed(1) + 's</i>' : '')
        + '</span>'
        + '</button>';
    }
    wrap.innerHTML = html;
    var coins = el('cityStartCoins');
    if(coins) coins.textContent = progress.coins;
    var rank = el('cityRank');
    if(rank){
      var RN = ['ROOKIE', 'RUNNER', 'DRIVER', 'HUSTLER', 'PRO', 'LEGEND'];
      rank.textContent = '· ' + RN[Math.min(progress.done.length, RN.length - 1)];
    }
  }

  function showModal(win, def, reason){
    if(!uiModal) return;
    var t = el('cityModalTitle'), s = el('cityModalText'), rw = el('cityModalReward');
    if(t) t.textContent = win ? 'MISSION COMPLETE' : 'MISSION FAILED';
    if(t) t.className = win ? 'nn-modal__t is-win' : 'nn-modal__t is-fail';
    if(s) s.textContent = (def ? def.name + ' · ' : '') + (reason || '');
    if(rw) rw.innerHTML = win ? '◈ ' + def.reward + ' coins &nbsp;·&nbsp; total ◈ ' + progress.coins : 'no coins this time — hit retry';
    var nextBtn = el('cityModalNext');
    if(nextBtn){
      var idx = 0;
      for(var i = 0; i < MISSIONS.length; i++) if(MISSIONS[i].id === def.id) idx = i;
      var nxt = MISSIONS[idx + 1];
      nextBtn.hidden = !win || !nxt;
      if(nxt) nextBtn.setAttribute('data-next', nxt.id);
    }
    showScreen('modal');
    syncHud();
  }

  function toast(msg){
    if(!elToast) return;
    elToast.textContent = msg;
    elToast.hidden = false;
    elToast.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ elToast.classList.remove('is-on'); setTimeout(function(){ elToast.hidden = true; }, 260); }, 1800);
  }

  /* ---------------- lifecycle ---------------- */
  var raf = null, last = 0;

  function startFree(){
    hideScreens();
    mis = null;
    playing = true; paused = false;
    setObjective('FREE ROAM', 'explore neon nagar · E to drive · N for nitro', 0);
    if(elTimer) elTimer.hidden = true;
    syncHud();
  }

  function restart(){
    var id = mis ? mis.id : null;
    resetWorld();
    if(id) startMission(id); else startFree();
  }

  function togglePause(force){
    if(!playing) return;
    paused = (typeof force === 'boolean') ? force : !paused;
    if(paused) showScreen('pause'); else hideScreens();
    if(paused) elBtnPause && elBtnPause.classList.add('on'); else elBtnPause && elBtnPause.classList.remove('on');
    var t = el('cityPauseTimer');
    if(t){
      var noClock = mis ? !missionById(mis.id).limit : true;
      if(paused && mis && noClock) t.textContent = 'no clock on this hustle';
      else if(paused && mis && mis.left > 0) t.textContent = 'clock paused · ' + Math.ceil(mis.left) + 's left';
      else if(paused && mis) t.textContent = 'clock starts at the pickup';
      else t.textContent = '';
    }
  }

  function fit(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var r = layer.getBoundingClientRect();
    W = Math.max(300, Math.round(r.width || window.innerWidth));
    H = Math.max(300, Math.round(r.height || window.innerHeight));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    glSize();
    if(miniEl){
      miniEl.width = Math.round(132 * DPR);
      miniEl.height = Math.round(132 * DPR);
      miniEl.style.width = '132px';
      miniEl.style.height = '132px';
    }
    cam.zoom = W < 560 ? 0.92 : (W < 900 ? 1 : 1.05);
    var vw = W / cam.zoom, vh = H / cam.zoom;
    cam.x = clamp(cam.x, 0, Math.max(0, WORLD - vw));
    cam.y = clamp(cam.y, 0, Math.max(0, WORLD - vh));
  }

  function loop(t){
    raf = requestAnimationFrame(loop);
    if(!last) last = t;
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if(playing && !paused){
      if(player.inCar) updateCar(dt); else updatePlayer(dt);
      updateTraffic(dt);
      updatePeds(dt);
      tickMission(dt);
      updateEffects(dt);
      updateCamera(dt);
      hudTick += dt; miniTick += dt;
      if(hudTick > 0.1){ hudTick = 0; syncHud(); }
      if(miniTick > 0.12){ miniTick = 0; drawMini(); }
    } else {
      updateEffects(dt);
      updateCamera(dt);
    }
    /* keep painting behind the start/modal screens, freeze the frame while paused (saves battery) */
    if(!paused) draw();
  }

  function openCity(){
    initGL();
    var gl = document.getElementById('gameLayer');
    if(gl && !gl.hidden){
      var gc = document.getElementById('gameClose');
      if(gc) gc.click();
    }
    layer.hidden = false;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    loadProgress();
    resetWorld();
    fit();
    playing = false; paused = false; mis = null; last = 0;
    renderStart();
    showScreen('start');
    setObjective('NEON NAGAR', 'pick a hustle to start', 0);
    if(elTimer) elTimer.hidden = true;
    syncHud();
    drawMini();
    if(!raf) raf = requestAnimationFrame(loop);
    try{ layer.querySelector('[data-mission]').focus(); }catch(e){}
  }

  function closeCity(){
    layer.hidden = true;
    if(raf){ cancelAnimationFrame(raf); raf = null; }
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    playing = false; paused = false;
    var tgl = document.getElementById('testToggle');
    if(tgl) tgl.focus();
  }

  function backToArcade(){
    closeCity();
    var gl = document.getElementById('gameLayer');
    var tgl = document.getElementById('testToggle');
    if(gl && gl.hidden && tgl) tgl.click();
  }


  /* =================== WEBGL 3D RENDERER =================== */
  var glcv = document.getElementById('cityGL');
  var GLW = {
    gl: null, ok: false, off: false, mode: 0, dpr: 1,
    prog: null, gprog: null, loc: {}, gloc: {},
    staticArr: null, staticN: 0, staticBuf: null, glowArr: null, glowN: 0, glowBuf: null, dynBuf: null, groundBuf: null,
    skyBuf: null, skyVerts: 0, skyProg: null, skyLoc: {}, tod: 8.6, head: 0, camInit: 0, clk: 0,
    dynArr: null, dynCnt: 0, groundVerts: 0, eye: [0, 0, 0], at: [0, 14, 0], sun: [0.4, 0.9, 0.45],
    dbg: { ground: 1, statics: 1, dyn: 1, glow: 1 }, q: 0,
    tPrev: 0, tSum: 0, tN: 0, checked: false, fps: 0,
    vp: new Float32Array(16), view: new Float32Array(16), proj: new Float32Array(16)
  };
  var CAM_MODES = [
    { name: '3D', dist: 172, high: 88, fov: 62, look: 250 },     /* chase camera */
    { name: 'HIGH', dist: 300, high: 430, fov: 54, look: 60 },
    { name: 'TOP', dist: 140, high: 900, fov: 50, look: 46 }
  ];

  /* time of day keyframes: sky gradient, ambient, sun strength, window/neon glow */
  var SKY_KEYS = [
    { h: 0.0,  top: [0.02, 0.03, 0.08], hor: [0.06, 0.08, 0.15], amb: 0.38, sun: 0.12, glow: 1.00 },
    { h: 5.0,  top: [0.06, 0.09, 0.20], hor: [0.40, 0.26, 0.30], amb: 0.38, sun: 0.22, glow: 0.85 },
    { h: 6.5,  top: [0.30, 0.42, 0.66], hor: [0.95, 0.62, 0.44], amb: 0.70, sun: 0.82, glow: 0.34 },
    { h: 9.0,  top: [0.36, 0.60, 0.88], hor: [0.80, 0.88, 0.96], amb: 1.02, sun: 1.12, glow: 0.12 },
    { h: 13.0, top: [0.32, 0.58, 0.90], hor: [0.82, 0.90, 0.98], amb: 1.14, sun: 1.24, glow: 0.08 },
    { h: 17.0, top: [0.34, 0.52, 0.80], hor: [0.92, 0.74, 0.58], amb: 0.96, sun: 1.02, glow: 0.20 },
    { h: 19.0, top: [0.22, 0.28, 0.55], hor: [0.98, 0.52, 0.34], amb: 0.60, sun: 0.52, glow: 0.62 },
    { h: 20.5, top: [0.09, 0.11, 0.28], hor: [0.42, 0.28, 0.36], amb: 0.44, sun: 0.20, glow: 0.90 },
    { h: 24.0, top: [0.02, 0.03, 0.08], hor: [0.06, 0.08, 0.15], amb: 0.38, sun: 0.12, glow: 1.00 }
  ];

  function skyAt(hh){
    var a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
    for(var i = 0; i < SKY_KEYS.length - 1; i++){
      if(hh >= SKY_KEYS[i].h && hh <= SKY_KEYS[i + 1].h){ a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    }
    var t = (hh - a.h) / Math.max(0.001, b.h - a.h);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var mix3 = function(u, v){ return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t]; };
    return {
      top: mix3(a.top, b.top), hor: mix3(a.hor, b.hor),
      amb: a.amb + (b.amb - a.amb) * t, sun: a.sun + (b.sun - a.sun) * t,
      glow: a.glow + (b.glow - a.glow) * t
    };
  }

  /* ---- tiny matrix helpers (column major) ---- */
  function m4persp(out, fovy, aspect, near, far){
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }
  function m4look(out, ex, ey, ez, cx, cy, cz){
    var fx = cx - ex, fy = cy - ey, fz = cz - ez;
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= fl; fy /= fl; fz /= fl;
    var sx = fy * 0 - fz * 1, sy = fz * 0 - fx * 0, sz = fx * 1 - fy * 0;
    var sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    var ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
    out[0] = sx; out[1] = ux; out[2] = -fx; out[3] = 0;
    out[4] = sy; out[5] = uy; out[6] = -fy; out[7] = 0;
    out[8] = sz; out[9] = uz; out[10] = -fz; out[11] = 0;
    out[12] = -(sx * ex + sy * ey + sz * ez);
    out[13] = -(ux * ex + uy * ey + uz * ez);
    out[14] = (fx * ex + fy * ey + fz * ez);
    out[15] = 1;
    return out;
  }
  function m4mul(out, a, b){
    for(var c = 0; c < 4; c++){
      for(var r = 0; r < 4; r++){
        out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  /* ---- shaders ---- */
  var VS_LIT = 'attribute vec3 aPos;\nattribute vec3 aNrm;\nattribute vec4 aCol;\n' +
    'uniform mat4 uMVP;\nuniform vec3 uEye;\nuniform vec3 uSun;\nuniform float uEmis;\n' +
    'uniform float uAmb;\nuniform float uSunI;\nuniform float uGlowMul;\n' +
    'uniform vec3 uFogCol;\nuniform float uFogNear;\nuniform float uFogFar;\nvarying vec3 vCol;\nvarying float vA;\n' +
    'void main(){\n' +
    '  gl_Position = uMVP * vec4(aPos, 1.0);\n' +
    '  float df = max(dot(normalize(aNrm), normalize(uSun)), 0.0);\n' +
    '  vec3 lit = aCol.rgb * (uAmb * 0.82 + uSunI * 0.5 * df);\n' +
    '  vec3 col = mix(lit, aCol.rgb * 1.45, uEmis * uGlowMul);\n' +
    '  float d = length(aPos - uEye);\n' +
    '  float fog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);\n' +
    '  col = mix(col, uFogCol, fog * 0.92);\n' +
    '  vCol = col; vA = aCol.a;\n' +
    '}';

  var VS_SKY = 'attribute vec2 aP;\nvarying vec2 vP;\n' +
    'void main(){ vP = aP; gl_Position = vec4(aP, 0.0, 1.0); }';
  var FS_SKY = 'precision mediump float;\nvarying vec2 vP;\nuniform vec3 uTop;\nuniform vec3 uHor;\n' +
    'uniform vec3 uSunCol;\nuniform vec2 uSunP;\nuniform float uSunI;\n' +
    'void main(){\n' +
    '  float t = clamp(vP.y * 0.5 + 0.5, 0.0, 1.0);\n' +
    '  vec3 col = mix(uHor, uTop, pow(t, 0.85));\n' +
    '  float d = length(vP - uSunP);\n' +
    '  col += uSunCol * exp(-d * d * 6.0) * 0.45 * uSunI;\n' +
    '  col += uSunCol * smoothstep(0.075, 0.048, d) * 1.1 * uSunI;\n' +
    '  gl_FragColor = vec4(col, 1.0);\n' +
    '}';

  var FS_LIT = 'precision mediump float;\nvarying vec3 vCol;\nvarying float vA;\n' +
    'void main(){ gl_FragColor = vec4(vCol, vA); }';

  var VS_GROUND = 'attribute vec2 aXZ;\nuniform mat4 uMVP;\nuniform float uPitch;\n' +
    'varying vec2 vUV;\nvarying vec3 vWP;\n' +
    'void main(){ gl_Position = uMVP * vec4(aXZ.x, 0.0, aXZ.y, 1.0); vUV = aXZ / uPitch; vWP = vec3(aXZ.x, 0.0, aXZ.y); }';

  var FS_GROUND = 'precision mediump float;\nuniform sampler2D uTex;\nuniform vec3 uEye;\n' +
    'uniform float uAmb;\nuniform vec3 uFogCol;\n' +
    'uniform float uFogNear;\nuniform float uFogFar;\nvarying vec2 vUV;\nvarying vec3 vWP;\n' +
    'void main(){\n' +
    '  vec3 col = texture2D(uTex, vUV).rgb * (0.5 + uAmb * 0.62);\n' +
    '  float d = length(vWP - uEye);\n' +
    '  col = mix(col, uFogCol, clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) * 0.92);\n' +
    '  gl_FragColor = vec4(col, 1.0);\n' +
    '}';

  function glShader(type, src){
    var s = GLW.gl.createShader(type);
    GLW.gl.shaderSource(s, src);
    GLW.gl.compileShader(s);
    if(!GLW.gl.getShaderParameter(s, GLW.gl.COMPILE_STATUS)){
      if(window.console) console.warn('city gl shader: ' + GLW.gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  function glProgram(vs, fs){
    var v = glShader(GLW.gl.VERTEX_SHADER, vs), f = glShader(GLW.gl.FRAGMENT_SHADER, fs);
    if(!v || !f) return null;
    var p = GLW.gl.createProgram();
    GLW.gl.attachShader(p, v);
    GLW.gl.attachShader(p, f);
    GLW.gl.linkProgram(p);
    if(!GLW.gl.getProgramParameter(p, GLW.gl.LINK_STATUS)){
      if(window.console) console.warn('city gl link: ' + GLW.gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function initGL(){
    if(GLW.gl || GLW.off) return;
    if(/[?&]gl=0/.test(location.search)){ GLW.off = true; GLW.mode = 3; return; }
    try{
      glcv = glcv || document.getElementById('cityGL');
      if(!glcv) throw new Error('no canvas');
      var opts = { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: false };
      var g = glcv.getContext('webgl', opts) || glcv.getContext('experimental-webgl', opts);
      if(!g) throw new Error('no webgl');
      GLW.gl = g;
      GLW.prog = glProgram(VS_LIT, FS_LIT);
      GLW.gprog = glProgram(VS_GROUND, FS_GROUND);
      GLW.skyProg = glProgram(VS_SKY, FS_SKY);
      if(!GLW.prog || !GLW.gprog || !GLW.skyProg) throw new Error('shader');
      var L = GLW.loc;
      L.aPos = g.getAttribLocation(GLW.prog, 'aPos');
      L.aNrm = g.getAttribLocation(GLW.prog, 'aNrm');
      L.aCol = g.getAttribLocation(GLW.prog, 'aCol');
      L.uMVP = g.getUniformLocation(GLW.prog, 'uMVP');
      L.uEye = g.getUniformLocation(GLW.prog, 'uEye');
      L.uSun = g.getUniformLocation(GLW.prog, 'uSun');
      L.uEmis = g.getUniformLocation(GLW.prog, 'uEmis');
      L.uAmb = g.getUniformLocation(GLW.prog, 'uAmb');
      L.uSunI = g.getUniformLocation(GLW.prog, 'uSunI');
      L.uGlowMul = g.getUniformLocation(GLW.prog, 'uGlowMul');
      L.uFogCol = g.getUniformLocation(GLW.prog, 'uFogCol');
      L.uFogNear = g.getUniformLocation(GLW.prog, 'uFogNear');
      L.uFogFar = g.getUniformLocation(GLW.prog, 'uFogFar');
      var G = GLW.gloc;
      G.aXZ = g.getAttribLocation(GLW.gprog, 'aXZ');
      G.uMVP = g.getUniformLocation(GLW.gprog, 'uMVP');
      G.uEye = g.getUniformLocation(GLW.gprog, 'uEye');
      G.uPitch = g.getUniformLocation(GLW.gprog, 'uPitch');
      G.uTex = g.getUniformLocation(GLW.gprog, 'uTex');
      G.uFogNear = g.getUniformLocation(GLW.gprog, 'uFogNear');
      G.uAmb = g.getUniformLocation(GLW.gprog, 'uAmb');
      G.uFogCol = g.getUniformLocation(GLW.gprog, 'uFogCol');
      var S = GLW.skyLoc;
      S.aP = g.getAttribLocation(GLW.skyProg, 'aP');
      S.uTop = g.getUniformLocation(GLW.skyProg, 'uTop');
      S.uHor = g.getUniformLocation(GLW.skyProg, 'uHor');
      S.uSunCol = g.getUniformLocation(GLW.skyProg, 'uSunCol');
      S.uSunP = g.getUniformLocation(GLW.skyProg, 'uSunP');
      S.uSunI = g.getUniformLocation(GLW.skyProg, 'uSunI');
      GLW.skyBuf = g.createBuffer();
      G.uFogFar = g.getUniformLocation(GLW.gprog, 'uFogFar');
      GLW.dynBuf = g.createBuffer();
      GLW.staticBuf = g.createBuffer();
      GLW.glowBuf = g.createBuffer();
      GLW.groundBuf = g.createBuffer();
      GLW.dynArr = new Float32Array(10 * 6 * 6 * 900);
      GLW.ok = true;
    }catch(err){
      GLW.ok = false;
      GLW.off = true;
    }
  }

  /* ---- geometry writers ---- */
  function gQuad(arr, i, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b, a){
    var pts = [ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz];
    for(var k = 0; k < 6; k++){
      arr[i] = pts[k * 3]; arr[i + 1] = pts[k * 3 + 1]; arr[i + 2] = pts[k * 3 + 2];
      arr[i + 3] = nx; arr[i + 4] = ny; arr[i + 5] = nz;
      arr[i + 6] = r; arr[i + 7] = g; arr[i + 8] = b; arr[i + 9] = a;
      i += 10;
    }
    return i;
  }
  function gBox(arr, i, x0, x1, y0, y1, z0, z1, r, g, b, a, rr, rg, rb){
    rr = rr === undefined ? Math.min(1, r * 1.2) : rr;
    rg = rg === undefined ? Math.min(1, g * 1.2) : rg;
    rb = rb === undefined ? Math.min(1, b * 1.2) : rb;
    i = gQuad(arr, i, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1, r, g, b, a);
    i = gQuad(arr, i, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1, r * 0.8, g * 0.8, b * 0.8, a);
    i = gQuad(arr, i, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0, r * 0.9, g * 0.9, b * 0.9, a);
    i = gQuad(arr, i, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0, r * 0.86, g * 0.86, b * 0.86, a);
    i = gQuad(arr, i, x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, 0, 1, 0, rr, rg, rb, a);
    return i;
  }
  function gRotBox(arr, i, cx, cz, hw, hd, ang, y0, y1, r, g, b, a, roofMul){
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var x1 = cx + (-hw * ca + hd * sa), z1 = cz + (-hw * sa - hd * ca);
    var x2 = cx + (hw * ca + hd * sa), z2 = cz + (hw * sa - hd * ca);
    var x3 = cx + (hw * ca - hd * sa), z3 = cz + (hw * sa + hd * ca);
    var x4 = cx + (-hw * ca - hd * sa), z4 = cz + (-hw * sa + hd * ca);
    i = gQuad(arr, i, x1, y0, z1, x2, y0, z2, x2, y1, z2, x1, y1, z1, sa, 0, -ca, r, g, b, a);
    i = gQuad(arr, i, x3, y0, z3, x4, y0, z4, x4, y1, z4, x3, y1, z3, -sa, 0, ca, r * 0.8, g * 0.8, b * 0.8, a);
    i = gQuad(arr, i, x4, y0, z4, x1, y0, z1, x1, y1, z1, x4, y1, z4, -ca, 0, -sa, r * 0.9, g * 0.9, b * 0.9, a);
    i = gQuad(arr, i, x2, y0, z2, x3, y0, z3, x3, y1, z3, x2, y1, z2, ca, 0, sa, r * 0.86, g * 0.86, b * 0.86, a);
    var m = roofMul === undefined ? 1.25 : roofMul;
    i = gQuad(arr, i, x1, y1, z1, x2, y1, z2, x3, y1, z3, x4, y1, z4, 0, 1, 0,
      Math.min(1, r * m), Math.min(1, g * m), Math.min(1, b * m), a);
    return i;
  }
  function gRing(arr, i, cx, cz, rad, wid, r, g, b, a, segs, y){
    y = y === undefined ? 2.4 : y;
    var inner = Math.max(1, rad - wid);
    for(var s = 0; s < segs; s++){
      var a0 = (s / segs) * Math.PI * 2, a1 = ((s + 1) / segs) * Math.PI * 2;
      var c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      i = gQuad(arr, i,
        cx + c0 * rad, y, cz + s0 * rad,
        cx + c1 * rad, y, cz + s1 * rad,
        cx + c1 * inner, y, cz + s1 * inner,
        cx + c0 * inner, y, cz + s0 * inner, 0, 1, 0, r, g, b, a);
    }
    return i;
  }
  function hexRgb(hex){
    if(!hex) return [0.6, 0.6, 0.6];
    var str = String(hex).trim();
    if(str.charAt(0) === 'r'){
      var mt = str.match(/[0-9]+(\.[0-9]+)?/g);
      if(mt && mt.length >= 3){
        return [Math.min(1, parseFloat(mt[0]) / 255), Math.min(1, parseFloat(mt[1]) / 255), Math.min(1, parseFloat(mt[2]) / 255)];
      }
    }
    var h = str.replace('#', '');
    if(h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if(isNaN(n)) return [0.6, 0.6, 0.6];
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function mixHex(hex, k){
    var c = hexRgb(hex);
    return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
  }

  /* ---- static city mesh ---- */
  function buildGroundTex(){
    var TS = 512, P = PITCH;
    var cv = document.createElement('canvas');
    cv.width = TS; cv.height = TS;
    var c2 = cv.getContext('2d');
    var k = TS / P;
    /* sidewalk plate */
    c2.fillStyle = '#9c988c';
    c2.fillRect(0, 0, TS, TS);
    /* pavement joints */
    c2.strokeStyle = 'rgba(120,116,104,0.55)';
    c2.lineWidth = 1;
    for(var jx = 0; jx < TS; jx += 26){
      c2.beginPath(); c2.moveTo(jx, 0); c2.lineTo(jx, TS); c2.stroke();
      c2.beginPath(); c2.moveTo(0, jx); c2.lineTo(TS, jx); c2.stroke();
    }
    /* asphalt */
    c2.fillStyle = '#403f3f';
    c2.fillRect(0, 0, ROADW * k, TS);
    c2.fillRect(0, 0, TS, ROADW * k);
    /* kerb line */
    c2.fillStyle = '#c8c3b6';
    c2.fillRect(ROADW * k - 3, 0, 3, TS);
    c2.fillRect(0, ROADW * k - 3, TS, 3);
    /* street markings: white lane dashes + double yellow centre */
    c2.fillStyle = 'rgba(240,238,230,0.9)';
    var dash = 42 * k, gap = 52 * k, mid = ROADW * k * 0.5;
    for(var a = 0; a < TS; a += dash + gap){
      c2.fillRect(a, mid - 1.2, dash, 2.4);
      c2.fillRect(mid - 1.2, a, 2.4, dash);
    }
    c2.fillStyle = 'rgba(214,178,74,0.95)';
    c2.fillRect(0, mid - 5, TS, 1.8);
    c2.fillRect(0, mid + 3.2, TS, 1.8);
    c2.fillRect(mid - 5, 0, 1.8, TS);
    c2.fillRect(mid + 3.2, 0, 1.8, TS);
    /* grain */
    c2.globalAlpha = 0.06;
    for(var g2 = 0; g2 < 260; g2++){
      c2.fillStyle = g2 % 2 ? '#ffffff' : '#000000';
      c2.fillRect(Math.random() * TS, Math.random() * TS, 2, 2);
    }
    c2.globalAlpha = 1;
    /* crosswalk hints at the tile corner */
    c2.fillStyle = 'rgba(240,240,235,0.5)';
    for(var s2 = 0; s2 < 4; s2++){
      c2.fillRect(8 + s2 * 22, ROADW * k + 6, 12, 10);
      c2.fillRect(ROADW * k + 6, 8 + s2 * 22, 10, 12);
    }
    var tex = GLW.gl.createTexture();
    GLW.gl.bindTexture(GLW.gl.TEXTURE_2D, tex);
    GLW.gl.pixelStorei(GLW.gl.UNPACK_FLIP_Y_WEBGL, 0);
    GLW.gl.texImage2D(GLW.gl.TEXTURE_2D, 0, GLW.gl.RGBA, GLW.gl.RGBA, GLW.gl.UNSIGNED_BYTE, cv);
    GLW.gl.texParameteri(GLW.gl.TEXTURE_2D, GLW.gl.TEXTURE_WRAP_S, GLW.gl.REPEAT);
    GLW.gl.texParameteri(GLW.gl.TEXTURE_2D, GLW.gl.TEXTURE_WRAP_T, GLW.gl.REPEAT);
    GLW.gl.texParameteri(GLW.gl.TEXTURE_2D, GLW.gl.TEXTURE_MIN_FILTER, GLW.gl.LINEAR_MIPMAP_LINEAR);
    GLW.gl.texParameteri(GLW.gl.TEXTURE_2D, GLW.gl.TEXTURE_MAG_FILTER, GLW.gl.LINEAR);
    GLW.gl.generateMipmap(GLW.gl.TEXTURE_2D);
    GLW.groundTex = tex;
  }

  function buildGLStatic(){
    if(!GLW.gl) return;
    var arr = [], i = 0, garr = [], gi = 0, n;
    for(n = 0; n < buildings.length; n++){
      var b = buildings[n];
      if(!b.h3){
        var seed = (b.x * 7 + b.y * 13) % 24;
        if(b.tag === 'garage') b.h3 = 26;
        else if(b.zone === 'downtown') b.h3 = 96 + (b.w > 200 ? 60 : 18) + seed * 3;
        else if(b.zone === 'industrial') b.h3 = 24 + seed * 0.7;
        else b.h3 = 34 + b.w * 0.07 + seed;
      }
      var h3 = b.h3;
      var wall = mixHex(b.wallA || '#26303f', 2.15);
      var roof = mixHex(b.roofA || '#2d3b50', 1.05);
      i = gBox(arr, i, b.x, b.x + b.w, 0, h3, b.y, b.y + b.h,
        wall[0], wall[1], wall[2], 1, roof[0], roof[1], roof[2]);
      if(b.w > 150 && b.h > 110){
        var bx0 = b.x + b.w * 0.22, bz0 = b.y + b.h * 0.26;
        i = gBox(arr, i, bx0, bx0 + 34, h3, h3 + 14, bz0, bz0 + 26, wall[0] * 1.15, wall[1] * 1.15, wall[2] * 1.15, 1);
        i = gBox(arr, i, b.x + b.w * 0.62, b.x + b.w * 0.62 + 22, h3, h3 + 9, b.y + b.h * 0.6,
          b.y + b.h * 0.6 + 22, wall[0], wall[1], wall[2], 1);
      }
      /* lit windows on all four walls, fixed pitch so they never turn into slabs */
      var wcol = hexRgb(b.neon || '#ffe6b8');
      var PX = 30, PY = 24, WW = 16, WH = 13;
      var ncx = Math.max(1, Math.floor((b.w - 20) / PX));
      var ncz = Math.max(1, Math.floor((b.h - 20) / PX));
      var nry = Math.max(1, Math.floor((h3 - 16) / PY));
      var litP = 1 + (b.winRow || 0) * 0.7;
      var wr = wcol[0] * 1.35, wg = wcol[1] * 1.3, wb2 = wcol[2] * 1.2;
      for(var r2 = 0; r2 < nry; r2++){
        var wy = 13 + r2 * PY;
        for(var c = 0; c < ncx; c++){
          if(((c * 7 + r2 * 5) % 9) < litP) continue;
          var wx0 = b.x + 12 + c * ((b.w - 24) / ncx), wx1 = wx0 + WW;
          gi = gQuad(garr, gi, wx0, wy, b.y + b.h + 0.7, wx1, wy, b.y + b.h + 0.7,
            wx1, wy + WH, b.y + b.h + 0.7, wx0, wy + WH, b.y + b.h + 0.7, 0, 0, 1, wr, wg, wb2, 0.82);
          gi = gQuad(garr, gi, wx1, wy, b.y - 0.7, wx0, wy, b.y - 0.7,
            wx0, wy + WH, b.y - 0.7, wx1, wy + WH, b.y - 0.7, 0, 0, -1, wr * 0.8, wg * 0.8, wb2 * 0.8, 0.62);
        }
        for(var c3 = 0; c3 < ncz; c3++){
          if(((c3 * 5 + r2 * 3) % 9) < litP) continue;
          var wz0 = b.y + 12 + c3 * ((b.h - 24) / ncz), wz1 = wz0 + WW;
          gi = gQuad(garr, gi, b.x + b.w + 0.7, wy, wz0, b.x + b.w + 0.7, wy, wz1,
            b.x + b.w + 0.7, wy + WH, wz1, b.x + b.w + 0.7, wy + WH, wz0, 1, 0, 0, wr, wg, wb2, 0.78);
          gi = gQuad(garr, gi, b.x - 0.7, wy, wz1, b.x - 0.7, wy, wz0,
            b.x - 0.7, wy + WH, wz0, b.x - 0.7, wy + WH, wz1, -1, 0, 0, wr * 0.8, wg * 0.8, wb2 * 0.8, 0.6);
        }
      }
      var nc = hexRgb(b.neon || '#33e0ff');
      gi = gQuad(garr, gi, b.x + 12, h3 - 8, b.y + b.h + 0.9, b.x + b.w - 12, h3 - 8, b.y + b.h + 0.9,
        b.x + b.w - 12, h3 - 2, b.y + b.h + 0.9, b.x + 12, h3 - 2, b.y + b.h + 0.9,
        0, 0, 1, nc[0] * 0.65, nc[1] * 0.65, nc[2] * 0.65, 0.75);
    }
    for(n = 0; n < lamps.length; n++){
      var lm = lamps[n];
      i = gBox(arr, i, lm.x - 3, lm.x + 3, 0, 34, lm.y - 3, lm.y + 3, 0.17, 0.2, 0.26, 1);
      gi = gBox(garr, gi, lm.x - 8, lm.x + 8, 34, 40, lm.y - 8, lm.y + 8, 1, 0.86, 0.52, 1, 1, 0.92, 0.62);
    }
    for(n = 0; n < trees.length; n++){
      var tr = trees[n];
      if(tr.palm){
        /* palm: thin trunk, ringed top, eight drooping fronds */
        var th = 54 + tr.r * 1.6;
        i = gBox(arr, i, tr.x - 2.6, tr.x + 2.6, 0, th, tr.y - 2.6, tr.y + 2.6, 0.42, 0.32, 0.22, 1);
        i = gBox(arr, i, tr.x - 3.4, tr.x + 3.4, th - 4, th, tr.y - 3.4, tr.y + 3.4, 0.34, 0.26, 0.18, 1);
        var fr = tr.r * 0.95, droop = 7 + tr.r * 0.25;
        for(var fd = 0; fd < 8; fd++){
          var an = fd * Math.PI / 4 + tr.s * 2;
          var cxx = Math.cos(an), czz = Math.sin(an);
          i = gQuad(arr, i,
            tr.x, th + 2, tr.y,
            tr.x + cxx * fr - czz * 3, th - droop, tr.y + czz * fr + cxx * 3,
            tr.x + cxx * fr * 1.5, th - droop - 3, tr.y + czz * fr * 1.5,
            tr.x + cxx * fr * 0.5 + czz * 3, th + 1, tr.y + czz * fr * 0.5 - cxx * 3,
            0, 1, 0, 0.16, 0.42, 0.2, 1);
        }
      } else {
        i = gBox(arr, i, tr.x - 3, tr.x + 3, 0, 16, tr.y - 3, tr.y + 3, 0.36, 0.27, 0.19, 1);
        i = gBox(arr, i, tr.x - tr.r * 0.8, tr.x + tr.r * 0.8, 14, 16 + tr.r * 2.1, tr.y - tr.r * 0.8, tr.y + tr.r * 0.8,
          0.17, 0.4, 0.2, 1, 0.24, 0.56, 0.3);
      }
    }
    /* parks + parking lots as painted ground plates */
    for(n = 0; n < parks.length; n++){
      var pk = parks[n];
      i = gQuad(arr, i, pk.x, 1.2, pk.y, pk.x + pk.w, 1.2, pk.y,
        pk.x + pk.w, 1.2, pk.y + pk.h, pk.x, 1.2, pk.y + pk.h, 0, 1, 0, 0.26, 0.46, 0.24, 1);
    }
    if(landmarks.lot){
      var lt = landmarks.lot;
      i = gQuad(arr, i, lt.x, 1.1, lt.y, lt.x + lt.w, 1.1, lt.y,
        lt.x + lt.w, 1.1, lt.y + lt.h, lt.x, 1.1, lt.y + lt.h, 0, 1, 0, 0.42, 0.42, 0.40, 1);
    }
    if(landmarks.bay){
      var by = landmarks.bay;
      gi = gQuad(garr, gi, by.x, 1.6, by.y, by.x + by.w, 1.6, by.y,
        by.x + by.w, 1.6, by.y + by.h, by.x, 1.6, by.y + by.h, 0, 1, 0, 0.35, 0.95, 0.5, 0.4);
    }

    GLW.staticArr = new Float32Array(i);
    for(n = 0; n < i; n++) GLW.staticArr[n] = arr[n];
    GLW.staticN = i / 10;
    GLW.gl.bindBuffer(GLW.gl.ARRAY_BUFFER, GLW.staticBuf);
    GLW.gl.bufferData(GLW.gl.ARRAY_BUFFER, GLW.staticArr, GLW.gl.STATIC_DRAW);

    GLW.glowArr = new Float32Array(gi);
    for(n = 0; n < gi; n++) GLW.glowArr[n] = garr[n];
    GLW.glowN = gi / 10;
    if(!GLW.glowBuf) GLW.glowBuf = GLW.gl.createBuffer();
    GLW.gl.bindBuffer(GLW.gl.ARRAY_BUFFER, GLW.glowBuf);
    GLW.gl.bufferData(GLW.gl.ARRAY_BUFFER, GLW.glowArr, GLW.gl.STATIC_DRAW);
  }

  function bindLit(g, buf){
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.enableVertexAttribArray(GLW.loc.aPos);
    g.vertexAttribPointer(GLW.loc.aPos, 3, g.FLOAT, false, 40, 0);
    g.enableVertexAttribArray(GLW.loc.aNrm);
    g.vertexAttribPointer(GLW.loc.aNrm, 3, g.FLOAT, false, 40, 12);
    g.enableVertexAttribArray(GLW.loc.aCol);
    g.vertexAttribPointer(GLW.loc.aCol, 4, g.FLOAT, false, 40, 24);
  }

  function glSize(){
    if(!GLW.ok) return;
    var w = Math.max(1, Math.round(W * GLW.dpr)), h = Math.max(1, Math.round(H * GLW.dpr));
    if(glcv.width !== w || glcv.height !== h){
      glcv.width = w;
      glcv.height = h;
    }
    if(glcv.style.width !== W + 'px') glcv.style.width = W + 'px';
    if(glcv.style.height !== H + 'px') glcv.style.height = H + 'px';
  }

  /* ---- per frame 3D scene ---- */
  function drawGL(){
    var g = GLW.gl;
    syncClock();
    GLW.dpr = Math.min(window.devicePixelRatio || 1, (W < 620 ? 1 : 1.25) * (GLW.q > 0 ? 0.8 : 1));
    glSize();
    g.viewport(0, 0, glcv.width, glcv.height);
    var sky = skyAt(GLW.tod);
    g.clearColor(sky.hor[0], sky.hor[1], sky.hor[2], 1);
    g.enable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    g.disable(g.BLEND);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);

    /* watch the frame rate: weak GPUs fall back to the flat renderer instead of stuttering */
    var nowMs = performance.now();
    if(GLW.tPrev){
      GLW.tSum += (nowMs - GLW.tPrev);
      GLW.tN++;
    }
    GLW.tPrev = nowMs;
    if(GLW.tN >= 24){
      var avg = GLW.tN * 1000 / Math.max(1, GLW.tSum);
      GLW.fps = Math.round(avg);
      GLW.tSum = 0; GLW.tN = 0; GLW.tPrev = 0;
      if(avg < 46 && GLW.q === 0){
        GLW.q = 1;                       /* step 1: cheaper pixels, keep the 3D look */
      } else if(avg < 32 && GLW.q === 1 && location.search.indexOf('nofallback') < 0){
        GLW.off = true;
        GLW.mode = 3;
        var cb = el('cityCam');
        if(cb){ cb.textContent = '2D'; cb.setAttribute('aria-label', 'Camera view: 2D'); }
        toast('slow GPU · switched to flat view');
      }
    }
    /* clock: one full day every ~7 minutes, unless the player pauses */
    var nowS = performance.now();
    if(GLW.clk){
      var dtd = (nowS - GLW.clk) / 1000;
      if(dtd > 0 && dtd < 0.5) GLW.tod = (GLW.tod + dtd * (24 / 420)) % 24;
    }
    GLW.clk = nowS;
    sky = skyAt(GLW.tod);

    var mode = CAM_MODES[GLW.mode % CAM_MODES.length];
    var fx = cam.x + (W / cam.zoom) / 2 + cam.sx, fz = cam.y + (H / cam.zoom) / 2 + cam.sy;
    var fit = Math.max(1, 760 / Math.max(320, H));
    /* portrait phones see a much narrower slice of the world — pull the camera back */
    if(W < 640) fit *= Math.max(1.15, Math.min(2.35, 640 / Math.max(320, W)));
    var fovNow = mode.fov + (W < 640 ? 6 : 0);
    if(player.inCar){ GLW.head = car.ang; }
    var ex, ey, ez, ax2, ay2, az2;
    if(GLW.mode === 0){
      /* chase camera: sit behind the car, look down the street ahead */
      var tgtX = player.inCar ? car.x : player.x, tgtZ = player.inCar ? car.y : player.y;
      var back = mode.dist * fit, up = mode.high * fit, ahead = mode.look * fit;
      var ch = Math.cos(GLW.head), sh = Math.sin(GLW.head);
      ex = tgtX - ch * back; ey = up; ez = tgtZ - sh * back;
      ax2 = tgtX + ch * ahead; ay2 = 26; az2 = tgtZ + sh * ahead;
    } else {
      ex = fx; ey = mode.high * fit; ez = fz + mode.dist * fit;
      ax2 = fx; ay2 = 14; az2 = fz - 46;
    }
    var lerp = GLW.camInit ? 0.24 : 1;
    GLW.camInit = 1;
    GLW.eye[0] += (ex - GLW.eye[0]) * lerp;
    GLW.eye[1] += (ey - GLW.eye[1]) * lerp;
    GLW.eye[2] += (ez - GLW.eye[2]) * lerp;
    GLW.at[0] += (ax2 - GLW.at[0]) * lerp;
    GLW.at[1] += (ay2 - GLW.at[1]) * lerp;
    GLW.at[2] += (az2 - GLW.at[2]) * lerp;
    m4persp(GLW.proj, fovNow * Math.PI / 180, W / Math.max(1, H), 8, 4600);
    m4look(GLW.view, GLW.eye[0], GLW.eye[1], GLW.eye[2], GLW.at[0], GLW.at[1], GLW.at[2]);
    m4mul(GLW.vp, GLW.proj, GLW.view);
    var fogNear = 480 * fit, fogFar = 1750 * fit;

    /* sun direction from the clock */
    var ha = (GLW.tod - 6) / 12 * Math.PI;
    var sunEl = Math.sin(ha);
    GLW.sun[0] = Math.cos(ha) * 0.85;
    GLW.sun[1] = Math.max(0.16, Math.abs(sunEl));
    GLW.sun[2] = 0.45;

    /* sky pass (depth writes off so it never hides the scene) */
    g.disable(g.DEPTH_TEST);
    g.depthMask(false);
    g.useProgram(GLW.skyProg);
    if(!GLW.skyVerts){
      g.bindBuffer(g.ARRAY_BUFFER, GLW.skyBuf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), g.STATIC_DRAW);
      GLW.skyVerts = 6;
    }
    g.bindBuffer(g.ARRAY_BUFFER, GLW.skyBuf);
    g.enableVertexAttribArray(GLW.skyLoc.aP);
    g.vertexAttribPointer(GLW.skyLoc.aP, 2, g.FLOAT, false, 0, 0);
    g.uniform3fv(GLW.skyLoc.uTop, sky.top);
    g.uniform3fv(GLW.skyLoc.uHor, sky.hor);
    /* project the sun into screen space for the disc + halo */
    var spx = GLW.eye[0] + GLW.sun[0] * 4000, spy = GLW.eye[1] + GLW.sun[1] * 4000, spz = GLW.eye[2] + GLW.sun[2] * 4000;
    var m = GLW.vp;
    var cw = m[3] * spx + m[7] * spy + m[11] * spz + m[15];
    var scx = (m[0] * spx + m[4] * spy + m[8] * spz + m[12]) / Math.max(0.001, cw);
    var scy = (m[1] * spx + m[5] * spy + m[9] * spz + m[13]) / Math.max(0.001, cw);
    if(cw <= 0){ scx = 5; scy = 5; }
    g.uniform2f(GLW.skyLoc.uSunP, scx, scy);
    g.uniform3f(GLW.skyLoc.uSunCol, 1.0, 0.88, 0.66);
    g.uniform1f(GLW.skyLoc.uSunI, Math.max(0.15, Math.min(1.2, sky.sun)));
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.disableVertexAttribArray(GLW.skyLoc.aP);
    g.depthMask(true);
    g.enable(g.DEPTH_TEST);

    /* ground */
    if(GLW.dbg.ground){
      g.useProgram(GLW.gprog);
      g.uniformMatrix4fv(GLW.gloc.uMVP, false, GLW.vp);
      g.uniform3fv(GLW.gloc.uEye, GLW.eye);
      g.uniform1f(GLW.gloc.uPitch, PITCH);
      g.uniform1f(GLW.gloc.uFogNear, fogNear);
      g.uniform1f(GLW.gloc.uFogFar, fogFar);
      g.uniform1f(GLW.gloc.uAmb, sky.amb);
      g.uniform3fv(GLW.gloc.uFogCol, sky.hor);
      if(!GLW.groundTex) buildGroundTex();
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, GLW.groundTex);
      g.uniform1i(GLW.gloc.uTex, 0);
      if(GLW.groundVerts === 0){
        var x0 = -1200, x1 = WORLD + 1200, z0 = -1200, z1 = WORLD + 1200;
        var gv = new Float32Array([x0, z0, x1, z0, x1, z1, x0, z0, x1, z1, x0, z1]);
        g.bindBuffer(g.ARRAY_BUFFER, GLW.groundBuf);
        g.bufferData(g.ARRAY_BUFFER, gv, g.STATIC_DRAW);
        GLW.groundVerts = 6;
      }
      g.bindBuffer(g.ARRAY_BUFFER, GLW.groundBuf);
      g.enableVertexAttribArray(GLW.gloc.aXZ);
      g.vertexAttribPointer(GLW.gloc.aXZ, 2, g.FLOAT, false, 0, 0);
      g.drawArrays(g.TRIANGLES, 0, GLW.groundVerts);
      g.disableVertexAttribArray(GLW.gloc.aXZ);
    }

    /* lit pass */
    g.useProgram(GLW.prog);
    g.uniformMatrix4fv(GLW.loc.uMVP, false, GLW.vp);
    g.uniform3fv(GLW.loc.uEye, GLW.eye);
    g.uniform3fv(GLW.loc.uSun, GLW.sun);
    g.uniform1f(GLW.loc.uAmb, sky.amb);
    g.uniform1f(GLW.loc.uSunI, sky.sun);
    g.uniform1f(GLW.loc.uGlowMul, sky.glow);
    g.uniform3fv(GLW.loc.uFogCol, sky.hor);
    g.uniform1f(GLW.loc.uFogNear, fogNear);
    g.uniform1f(GLW.loc.uFogFar, fogFar);
    if(GLW.staticN > 0 && GLW.dbg.statics){
      g.uniform1f(GLW.loc.uEmis, 0.0);
      bindLit(g, GLW.staticBuf);
      g.drawArrays(g.TRIANGLES, 0, GLW.staticN);
    }

    /* dynamic props */
    var a = GLW.dynArr, i = 0, n;
    for(n = 0; n < traffic.length; n++){
      var tr = traffic[n], tp = trafficPos(tr), tc = hexRgb(tr.color);
      i = gRotBox(a, i, tp.x, tp.y, 26, 13, tr.ang, 2, 13, tc[0], tc[1], tc[2], 1);
      i = gRotBox(a, i, tp.x, tp.y, 15, 10, tr.ang, 13, 21, tc[0] * 0.55, tc[1] * 0.6, tc[2] * 0.65, 1);
    }
    var pcol = hexRgb('#4ade80');
    i = gRotBox(a, i, car.x, car.y, 24, 13, car.ang, 2, 14, pcol[0], pcol[1], pcol[2], 1);
    i = gRotBox(a, i, car.x, car.y, 13, 10, car.ang, 14, 22, pcol[0] * 0.5, pcol[1] * 0.55, pcol[2] * 0.55, 1);
    if(!player.inCar){
      i = gBox(a, i, player.x - 7, player.x + 7, 0, 18, player.y - 6, player.y + 6, 0.5, 0.92, 0.68, 1);
      i = gBox(a, i, player.x - 5, player.x + 5, 18, 26, player.y - 5, player.y + 5, 0.88, 0.95, 0.9, 1);
    }
    for(n = 0; n < crates.length; n++){
      var cr = crates[n];
      if(!cr.alive) continue;
      var ccol = hexRgb(['#ff9f45', '#ffd166', '#33e0ff'][cr.hue] || '#ff9f45');
      i = gBox(a, i, cr.x - 15, cr.x + 15, 0, 26, cr.y - 15, cr.y + 15, ccol[0], ccol[1], ccol[2], 1);
    }
    for(n = 0; n < peds.length; n++){
      var pe = peds[n], pc = hexRgb(pe.color), plift = pe.hop * 2.8;
      i = gBox(a, i, pe.x - 4, pe.x + 4, plift, plift + 11, pe.y - 4, pe.y + 4, pc[0], pc[1], pc[2], 1);
      i = gBox(a, i, pe.x - 3, pe.x + 3, plift + 11, plift + 17, pe.y - 3, pe.y + 3, 0.9, 0.95, 0.93, 1);
    }
    var tnow = performance.now() / 1000;
    var pulse = 0.5 + 0.5 * Math.sin(tnow * 3.2);
    if(mis && mis.target && !mis.done){
      var mcol = hexRgb(mis.target.color || '#33e0ff');
      if(mis.target.label === 'PARCEL' || mis.target.label === 'CRATE'){
        var bob = Math.sin(tnow * 2.6) * 5;
        i = gBox(a, i, mis.target.x - 11, mis.target.x + 11, 8 + bob, 42 + bob, mis.target.y - 11, mis.target.y + 11,
          mcol[0], mcol[1], mcol[2], 1, mcol[0] * 1.2, mcol[1] * 1.2, mcol[2] * 1.2);
      }
    }
    g.bindBuffer(g.ARRAY_BUFFER, GLW.dynBuf);
    g.bufferData(g.ARRAY_BUFFER, a.subarray(0, i), g.DYNAMIC_DRAW);
    g.uniform1f(GLW.loc.uEmis, 0.22);
    if(GLW.dbg.dyn){ bindLit(g, GLW.dynBuf);
    g.drawArrays(g.TRIANGLES, 0, i / 10); }

    /* glow pass: ground rings + lamp pools (additive) */
    var b2 = GLW.dynArr, j = 0;
    if(mis && mis.target && !mis.done && mis.target.label !== 'PARCEL' && mis.target.label !== 'CRATE'){
      var mc = hexRgb(mis.target.color || '#33e0ff');
      j = gRing(b2, j, mis.target.x, mis.target.y, mis.target.r, 7, mc[0], mc[1], mc[2], 0.55 + 0.35 * pulse, 26);
      j = gRing(b2, j, mis.target.x, mis.target.y, mis.target.r + 10, 3, mc[0], mc[1], mc[2], 0.25, 26);
    }
    var wpx = player.inCar ? car.x : player.x, wpy = player.inCar ? car.y : player.y;
    j = gRing(b2, j, wpx, wpy, 26, 5, 0.45, 1.0, 0.72, 0.5, 20, 1.6);
    if(GLW.q === 0 || sky.glow > 0.45){
      for(n = 0; n < lamps.length; n++){
        var lp = lamps[n];
        if(Math.abs(lp.x - fx) > 760 || Math.abs(lp.y - fz) > 760) continue;
        j = gQuad(b2, j, lp.x - 92, 1.5, lp.y - 92, lp.x + 92, 1.5, lp.y - 92,
          lp.x + 92, 1.5, lp.y + 92, lp.x - 92, 1.5, lp.y + 92, 0, 1, 0, 1, 0.82, 0.5, 0.085);
      }
    }
    if(j > 0 && GLW.dbg.glow){
      g.enable(g.BLEND);
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.depthMask(false);
      g.uniform1f(GLW.loc.uEmis, 1.0);
      g.uniform1f(GLW.loc.uGlowMul, Math.max(0.06, sky.glow));
      g.bindBuffer(g.ARRAY_BUFFER, GLW.dynBuf);
      g.bufferData(g.ARRAY_BUFFER, b2.subarray(0, j), g.DYNAMIC_DRAW);
      bindLit(g, GLW.dynBuf);
      g.drawArrays(g.TRIANGLES, 0, j / 10);
      if(GLW.glowN > 0 && GLW.dbg.statics){
        bindLit(g, GLW.glowBuf);
        g.drawArrays(g.TRIANGLES, 0, GLW.glowN);
      }
      g.depthMask(true);
      g.disable(g.BLEND);
    }
  }

  /* project a world point to css px (used by the 2D overlay) */
  function proj3(x, hgt, z){
    var m = GLW.vp;
    if(!GLW.ok) return null;
    var cx = m[0] * x + m[4] * hgt + m[8] * z + m[12];
    var cy = m[1] * x + m[5] * hgt + m[9] * z + m[13];
    var cw = m[3] * x + m[7] * hgt + m[11] * z + m[15];
    if(cw <= 1) return null;
    return { x: (cx / cw * 0.5 + 0.5) * W, y: (0.5 - cy / cw * 0.5) * H };
  }


  /* =================== 2D OVERLAY ON TOP OF THE 3D SCENE =================== */
  function drawOverlay(){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var n, p;

    /* particles */
    for(n = 0; n < particles.length; n++){
      p = particles[n];
      if(p.life <= 0) continue;
      var pp = proj3(p.x, 8, p.y);
      if(!pp) continue;
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle = p.c;
      var pr = Math.max(1.5, p.r * Math.min(2.4, 26 / Math.max(6, Math.hypot(pp.x - W / 2, pp.y - H / 2) * 0.06)));
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* floating text pops */
    for(n = 0; n < pops.length; n++){
      p = pops[n];
      var tp = proj3(p.x, 30, p.y);
      if(!tp) continue;
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      ctx.fillStyle = p.c;
      ctx.font = '700 13px JBMonoEmbed, ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.txt, tp.x, tp.y - p.t * 26);
    }
    ctx.globalAlpha = 1;

    /* landmark names floating over their roofs */
    var named = [[landmarks.garage, 'RUSTOM GARAGE', '#7cf59a'],
                 [landmarks.shop, 'CURRY CORNER', '#ffd166'],
                 [landmarks.tower, 'NEON TOWER', '#33e0ff']];
    ctx.font = '700 11px JBMonoEmbed, ui-monospace, monospace';
    ctx.textAlign = 'center';
    for(n = 0; n < named.length; n++){
      var lb = named[n][0];
      if(!lb) continue;
      if(Math.abs(lb.x - (cam.x + W / 2)) > W * 0.9) continue;
      var lp = proj3(lb.x, 74, lb.y);
      if(!lp || lp.x < 40 || lp.x > W - 40 || lp.y < 30 || lp.y > H - 20) continue;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.shadowColor = named[n][2];
      ctx.shadowBlur = 12;
      ctx.fillStyle = named[n][2];
      ctx.fillText(named[n][1], lp.x, lp.y);
      ctx.restore();
    }

    /* mission marker label */
    if(mis && mis.target && !mis.done){
      var mt = proj3(mis.target.x, 56, mis.target.y);
      if(mt && mt.x > 30 && mt.x < W - 30 && mt.y > 24 && mt.y < H - 10){
        ctx.save();
        ctx.font = '700 12px JBMonoEmbed, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = mis.target.color || '#33e0ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 14;
        ctx.fillText(mis.target.label, mt.x, mt.y);
        ctx.restore();
      }
      /* off screen objective arrow */
      var pad2 = 56, axd = 0, ayd = 0, aang = 0, off = true;
      if(mt) off = (mt.x < pad2 || mt.y < pad2 || mt.x > W - pad2 || mt.y > H - pad2);
      if(off){
        var ccx = W / 2, ccy = H / 2;
        if(mt) aang = Math.atan2(mt.y - ccy, mt.x - ccx);
        else {
          var wpx = player.inCar ? car.x : player.x, wpy = player.inCar ? car.y : player.y;
          aang = Math.atan2((mis.target.y - wpy) * 0.7, mis.target.x - wpx);
          if(Math.abs(aang) > Math.PI / 2) aang = aang;   /* screen space map */
        }
        var lim = Math.min((W / 2 - pad2) / Math.max(0.0001, Math.abs(Math.cos(aang))),
                           (H / 2 - pad2) / Math.max(0.0001, Math.abs(Math.sin(aang))));
        axd = ccx + Math.cos(aang) * lim;
        ayd = ccy + Math.sin(aang) * lim;
        ctx.save();
        ctx.translate(axd, ayd);
        ctx.rotate(aang);
        ctx.fillStyle = mis.target.color || '#33e0ff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(-9, -9); ctx.lineTo(-3, 0); ctx.lineTo(-9, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        var wpx2 = player.inCar ? car.x : player.x, wpy2 = player.inCar ? car.y : player.y;
        ctx.save();
        ctx.fillStyle = 'rgba(226,244,255,0.9)';
        ctx.font = '700 11px JBMonoEmbed, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(dist(wpx2, wpy2, mis.target.x, mis.target.y) / 10) + 'm', axd, ayd + 26);
        ctx.restore();
      }
    }

    /* drive hint above the parked car */
    if(!player.inCar && nearCar()){
      var cp = proj3(car.x, 34, car.y);
      if(cp){
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '700 12px JBMonoEmbed, ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('E · drive', cp.x, cp.y - 6);
        ctx.restore();
      }
    }

    /* vignette */
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(2,4,8,0.66)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'left';
  }

  function draw(){
    if(GLW.ok && !GLW.off && GLW.mode < 3){ drawGL(); drawOverlay(); }
    else draw2D();
  }

  function cycleCam(){
    GLW.mode = (GLW.mode + 1) % 4;
    if(GLW.mode < 3) GLW.off = false;
    var btn = el('cityCam');
    var label = GLW.mode < 3 ? CAM_MODES[GLW.mode].name : '2D';
    if(btn){
      btn.textContent = label;
      btn.setAttribute('aria-label', 'Camera view: ' + label);
    }
    toast('camera · ' + (GLW.mode < 3 ? CAM_MODES[GLW.mode].name + ' view' : 'flat view'));
  }

  /* ---------------- wiring ---------------- */
  function on(id, fn){
    var n = el(id);
    if(n) n.addEventListener('click', function(e){ e.preventDefault(); fn(e); });
  }

  on('cityStartPlay', function(){ startFree(); });
  on('cityHowToggle', function(){
    var p = el('cityHow');
    if(!p) return;
    p.hidden = !p.hidden;
    el('cityHowToggle').setAttribute('aria-expanded', String(!p.hidden));
  });
  on('cityStartArcade', backToArcade);
  on('cityResume', function(){ togglePause(false); });
  on('cityRestart', function(){ togglePause(false); restart(); });
  on('cityChange', function(){ paused = false; playing = false; renderStart(); showScreen('start'); });
  on('cityPauseArcade', backToArcade);
  on('cityPauseHowBtn', function(){
    var p = el('cityPauseHow');
    if(!p) return;
    p.hidden = !p.hidden;
    el('cityPauseHowBtn').setAttribute('aria-expanded', String(!p.hidden));
  });
  on('cityPause', function(){ togglePause(); });
  on('cityCam', cycleCam);

  /* ---------------- clock / time of day ---------------- */
  function clockText(){
    var hh = Math.floor(GLW.tod), mm = Math.floor((GLW.tod - hh) * 60);
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  var clockEl = el('cityClock'), clockLast = '';
  function syncClock(){
    if(!clockEl || GLW.off) return;
    var t = clockText();
    if(t !== clockLast){
      clockLast = t;
      clockEl.textContent = t;
      clockEl.setAttribute('aria-label', 'Time of day ' + t + ' — press to skip ahead');
    }
  }
  function skipTime(){
    GLW.tod = (GLW.tod + 3) % 24;
    syncClock();
    toast('time · ' + clockText());
  }
  on('cityClock', skipTime);
  on('cityModalRetry', function(){ hideScreens(); resetWorld(); if(mis) startMission(mis.id); else startFree(); });
  on('cityModalMissions', function(){ playing = false; renderStart(); showScreen('start'); });
  on('cityModalFree', function(){ hideScreens(); startFree(); });
  on('cityModalNext', function(){
    var n = el('cityModalNext').getAttribute('data-next');
    hideScreens(); resetWorld();
    if(n) startMission(n);
  });
  on('citySound', function(){
    audio.on = !audio.on;
    progress.sound = audio.on;
    saveProgress();
    elBtnSound.textContent = audio.on ? '♪' : '✕';
    elBtnSound.setAttribute('aria-pressed', String(audio.on));
    if(audio.on) sfx('coin');
  });
  on('cityQuit', function(){ playing = false; renderStart(); showScreen('start'); });
  on('cityStartHelp2', function(){ var p = el('cityHow'); if(p){ p.hidden = false; } });

  (function(){
    var wrap = el('cityMissions');
    if(!wrap) return;
    wrap.addEventListener('click', function(e){
      var b = e.target.closest('.nn-mis');
      if(!b || b.disabled) return;
      var id = b.getAttribute('data-mission');
      hideScreens();
      resetWorld();
      startMission(id);
    });
  })();

  var helpClose = el('cityHowClose');
  if(helpClose) helpClose.addEventListener('click', function(){ var p = el('cityHow'); if(p) p.hidden = true; });

  window.addEventListener('resize', function(){ if(!layer.hidden) fit(); });

  /* never let the clock run while the tab is in the background */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden && !layer.hidden && playing && !paused) togglePause(true);
  });

  /* keep page scroll locked while the city runs */
  layer.addEventListener('touchmove', function(e){ if(e.target === canvas) e.preventDefault(); }, {passive: false});

  /* launch from the arcade picker */
  document.addEventListener('click', function(e){
    var card = e.target && e.target.closest ? e.target.closest('.pickcard[data-game="city"]') : null;
    if(!card) return;
    e.preventDefault();
    e.stopPropagation();
    openCity();
  }, true);

  if(elBtnSound){
    elBtnSound.textContent = audio.on ? '♪' : '✕';
    elBtnSound.setAttribute('aria-pressed', String(audio.on));
  }

  window.__city = {
    open: openCity,
    close: closeCity,
    start: function(id){ hideScreens(); resetWorld(); startMission(id); },
    free: function(){ resetWorld(); startFree(); },
    pause: togglePause,
    state: function(){
      return {
        playing: playing, paused: paused, mis: mis && mis.id, done: mis ? mis.done : null,
        left: mis ? +mis.left.toFixed(1) : null, stage: mis ? mis.stage : null,
        coins: progress.coins, cleared: progress.done.slice(),
        player: { x: player.x, y: player.y, inCar: player.inCar },
        car: { x: car.x, y: car.y, ang: +car.ang.toFixed(3), speed: +Math.sqrt(car.vx * car.vx + car.vy * car.vy).toFixed(1), nitro: +car.nitro.toFixed(2) },
        target: mis && mis.target ? { x: mis.target.x, y: mis.target.y, label: mis.target.label, r: mis.target.r } : null,
        crates: crates.map(function(c){ return c.alive; }),
        crateList: crates.map(function(c){ return { x: Math.round(c.x), y: Math.round(c.y), alive: c.alive }; }),
        buildings: buildings.length,
        world: { w: WORLD, grid: GRID, pitch: PITCH },
        landmarks: { garage: landmarks.garage, shop: landmarks.shop, tower: landmarks.tower, bay: landmarks.bay }
      };
    },
    gl: function(){ return { ok: GLW.ok, off: GLW.off, mode: GLW.mode, fps: GLW.fps, q: GLW.q, tod: Math.round(GLW.tod * 100) / 100, clock: clockText(), staticN: GLW.staticN, dynN: GLW.dynCnt, ground: GLW.groundVerts }; },
    time: function(h){ if(typeof h === 'number'){ GLW.tod = ((h % 24) + 24) % 24; GLW.clk = 0; syncClock(); } return GLW.tod; },
    trees: function(){ return trees.map(function(t){ return { x: Math.round(t.x), y: Math.round(t.y), r: Math.round(t.r) }; }); },
    dbg: function(k, v){ if(k === undefined) return GLW.dbg; if(v === undefined) return GLW.dbg[k]; GLW.dbg[k] = v; return GLW.dbg[k]; },
    listBuildings: function(){
      return buildings.map(function(b){ return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }; });
    },
    warp: function(x, y){
      if(player.inCar){ car.x = x; car.y = y; car.vx = 0; car.vy = 0; }
      else { player.x = x; player.y = y; player.vx = 0; player.vy = 0; }
      cam.x = x - (W / cam.zoom) / 2; cam.y = y - (H / cam.zoom) / 2;
    },
    setCar: function(x, y, ang){
      player.inCar = true;
      car.x = x; car.y = y; car.ang = ang || 0; car.vx = 0; car.vy = 0;
      cam.x = x - (W / cam.zoom) / 2; cam.y = y - (H / cam.zoom) / 2;
    },
    reset: function(){ loadProgress(); resetWorld(); renderStart(); }
  };
})();

