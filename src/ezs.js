/* ============================================================
   EZS — stickman arena. waves, then a duel boss every 5th wave.
   original art, canvas 2d, no external assets.
   ============================================================ */
(function(){
  var layer = document.getElementById('ezsLayer');
  if(!layer) return;
  var cv = document.getElementById('ezsCanvas');
  var ctx = cv.getContext('2d');

  var elWave = document.getElementById('ezsWave');
  var elScore = document.getElementById('ezsScore');
  var elBest = document.getElementById('ezsBest');
  var elHp = document.getElementById('ezsHpBar');
  var elAmmo = document.getElementById('ezsAmmoBar');
  var elBossWrap = document.getElementById('ezsBoss');
  var elBossBar = document.getElementById('ezsBossBar');
  var elLive = document.getElementById('ezsLive');
  var panel = document.getElementById('ezsPanel');
  var pTitle = document.getElementById('ezsPTitle');
  var pText = document.getElementById('ezsPText');
  var pMain = document.getElementById('ezsPMain');
  var pAlt = document.getElementById('ezsPAlt');
  var sndBtn = document.getElementById('ezsSound');

  var W = 960, H = 540, DPR = 1;
  var groundY = 0;
  var running = false, raf = 0, lastT = 0, state = 'intro';   /* intro | play | pause | over */

  var BEST_KEY = 'evorez_best_ezs';
  var best = 0;
  try { best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch(e){ best = 0; }

  var player, wave, score, enemies, bullets, bits, queue, spawnT, breather, boss, shake, aimM, aimUse, firing, held, soundOn, elapsed, hurtFlash, combo, comboT;

  /* ---------------- sound ---------------- */
  var AC = null;
  function ac(){
    if(!soundOn) return null;
    try{
      if(!AC){ var K = window.AudioContext || window.webkitAudioContext; if(!K) return null; AC = new K(); }
      if(AC.state === 'suspended' && AC.resume) AC.resume();
      return AC;
    }catch(e){ return null; }
  }
  function blip(freq, dur, type, vol, slide){
    var a = ac(); if(!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, a.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), a.currentTime + dur);
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, a.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + 0.02);
  }
  function noise(dur, vol){
    var a = ac(); if(!a) return;
    var n = a.createBufferSource(), buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
    var d = buf.getChannelData(0);
    for(var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    var g = a.createGain(); g.gain.value = vol || 0.06;
    n.connect(g); g.connect(a.destination); n.start();
  }
  function sfx(kind){
    if(!soundOn) return;
    if(kind === 'shoot') blip(680, 0.07, 'square', 0.035, 260);
    else if(kind === 'eshot') blip(300, 0.09, 'sawtooth', 0.028, 150);
    else if(kind === 'hit') noise(0.07, 0.05);
    else if(kind === 'kill') blip(180, 0.16, 'triangle', 0.05, 70);
    else if(kind === 'hurt') blip(120, 0.24, 'sawtooth', 0.06, 60);
    else if(kind === 'wave') blip(520, 0.12, 'triangle', 0.05, 900);
    else if(kind === 'boss') { blip(90, 0.5, 'sawtooth', 0.07, 60); noise(0.4, 0.05); }
    else if(kind === 'reload') blip(240, 0.06, 'square', 0.03, 420);
  }

  /* ---------------- boot ---------------- */
  function reset(){
    wave = 0; score = 0; combo = 0; comboT = 0; elapsed = 0;
    enemies = []; bullets = []; bits = []; queue = []; spawnT = 0; breather = 1.1;
    boss = null; shake = 0; hurtFlash = 0;
    player = {
      x: W * 0.5, y: groundY, vx: 0, vy: 0, onGround: true, face: 1,
      hp: 100, hpMax: 100, ang: 0, cd: 0, mag: 24, magMax: 24, reload: 0,
      walk: 0, dead: false, flash: 0
    };
    if(elBossWrap) elBossWrap.hidden = true;
    syncHud();
  }

  function size(){
    var r = layer.getBoundingClientRect();
    W = Math.max(320, Math.round(r.width));
    H = Math.max(320, Math.round(r.height));
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    groundY = Math.round(H * 0.8);
    if(player && player.onGround) player.y = groundY;
  }

  function syncHud(){
    if(elWave) elWave.textContent = wave;
    if(elScore) elScore.textContent = score;
    if(elBest) elBest.textContent = Math.max(best, score);
    if(elHp) elHp.style.width = Math.max(0, (player ? player.hp / player.hpMax : 0) * 100) + '%';
    if(elAmmo) elAmmo.style.width = Math.max(0, (player ? (player.reload > 0 ? 0 : player.mag / player.magMax) : 0) * 100) + '%';
  }
  function say(msg){ if(elLive){ elLive.textContent = msg; } }

  /* ---------------- panels ---------------- */
  function showPanel(kind){
    if(!panel) return;
    panel.hidden = false;
    if(kind === 'intro'){
      pTitle.textContent = 'EZS';
      pText.innerHTML = 'stickman arena. <b>waves</b> aate hain, har 5th wave pe ek <b>duel boss</b>. marne se pehle jitna score kar sakte ho.';
      pMain.textContent = 'START';
      pAlt.hidden = false; pAlt.textContent = 'LEAVE';
    } else if(kind === 'pause'){
      pTitle.textContent = 'PAUSED';
      pText.innerHTML = 'wave <b>' + wave + '</b> · score <b>' + score + '</b>';
      pMain.textContent = 'RESUME';
      pAlt.hidden = false; pAlt.textContent = 'LEAVE';
    } else if(kind === 'over'){
      pTitle.textContent = 'GAME OVER';
      var isBest = score >= best && score > 0;
      pText.innerHTML = 'score <b>' + score + '</b> · wave <b>' + wave + '</b>' + (isBest ? ' · <b>new best</b>' : ' · best <b>' + best + '</b>');
      pMain.textContent = 'RETRY';
      pAlt.hidden = false; pAlt.textContent = 'LEAVE';
    }
  }
  function hidePanel(){ if(panel) panel.hidden = true; }

  /* ---------------- waves ---------------- */
  function startRun(){
    size(); reset();
    state = 'play'; running = true;
    hidePanel();
    nextWave();
    lastT = 0;
    if(!raf) raf = requestAnimationFrame(loop);
    say('EZS started');
  }
  function nextWave(){
    wave++;
    queue = [];                 /* never carry leftovers into a new wave */
    if(wave % 5 === 0){ spawnBoss(); say('Wave ' + wave + ' boss'); }
    else {
      var n = 3 + Math.round(wave * 1.5);
      queue = [];
      for(var i = 0; i < n; i++){
        var roll = Math.random();
        var type = roll > 0.72 ? 'runner' : (roll > 0.42 ? 'shooter' : 'grunt');
        queue.push(type);
      }
      say('Wave ' + wave);
    }
    if(elBossWrap && wave % 5 !== 0) elBossWrap.hidden = true;
    sfx('wave');
    syncHud();
  }
  function spawnBoss(){
    boss = {
      x: Math.random() < 0.5 ? -90 : W + 90, y: groundY, hp: 300 + wave * 45, hpMax: 300 + wave * 45,
      face: 0, cd: 1.6, phase: 0, walk: 0, flash: 0, charging: 0, boss: true
    };
    boss.face = boss.x < W / 2 ? 1 : -1;
    if(elBossWrap){ elBossWrap.hidden = false; }
    sfx('boss');
  }
  function spawnEnemy(type){
    var fromLeft = Math.random() < 0.5;
    var e = {
      x: fromLeft ? -50 : W + 50, y: groundY, type: type, face: fromLeft ? 1 : -1,
      hp: type === 'runner' ? 22 : (type === 'shooter' ? 40 : 30),
      speed: type === 'runner' ? 165 : (type === 'shooter' ? 62 : 88),
      cd: 0.8 + Math.random() * 1.2, walk: Math.random() * 6, flash: 0, melee: 0
    };
    e.hpMax = e.hp;
    enemies.push(e);
  }

  /* ---------------- input ---------------- */
  held = { left: false, right: false, jump: false };
  firing = false; aimM = { x: 0, y: 0, on: false }; aimUse = false;
  soundOn = true;

  function onKey(e, down){
    if(state === 'intro' || state === 'over') return;
    var k = e.key;
    if(k === 'Escape' || k === 'p' || k === 'P'){
      if(down){ e.preventDefault(); togglePause(); }
      return;
    }
    if(k === 'r' || k === 'R'){ if(down){ e.preventDefault(); startReload(); } return; }
    if(k === 'a' || k === 'A' || k === 'ArrowLeft'){ held.left = down; e.preventDefault(); }
    else if(k === 'd' || k === 'D' || k === 'ArrowRight'){ held.right = down; e.preventDefault(); }
    else if(k === 'w' || k === 'W' || k === 'ArrowUp' || k === ' '){ held.jump = down; if(down) e.preventDefault(); }
    else if(k === 'j' || k === 'J' || k === 'f' || k === 'F' || k === 'Enter'){ firing = down; if(down){ aimUse = false; e.preventDefault(); } }
  }
  function keyDown(e){
    if(layer.hidden) return;
    onKey(e, true);
  }
  function keyUp(e){
    if(layer.hidden) return;
    onKey(e, false);
  }

  function bindHold(el, on, off){
    if(!el) return;
    var press = function(e){ if(e && e.cancelable) e.preventDefault(); el.classList.add('on'); on(); };
    var release = function(e){ if(e && e.cancelable) e.preventDefault(); el.classList.remove('on'); off(); };
    el.addEventListener('touchstart', press, {passive: false});
    el.addEventListener('touchend', release, {passive: false});
    el.addEventListener('touchcancel', release, {passive: false});
    el.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'touch') return;
      press(e);
      if(el.setPointerCapture){ try{ el.setPointerCapture(e.pointerId); }catch(err){} }
    }, {passive: false});
    el.addEventListener('pointerup', function(e){ if(e.pointerType === 'touch') return; release(e); });
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', function(e){ if(e.pointerType !== 'touch') release(e); });
  }

  var box = document.getElementById('ezsTouch');
  if(box){
    var btns = box.querySelectorAll('[data-ezs]');
    for(var bi = 0; bi < btns.length; bi++){
      (function(b){
        var act = b.getAttribute('data-ezs');
        bindHold(b,
          function(){
            if(act === 'left') held.left = true;
            else if(act === 'right') held.right = true;
            else if(act === 'jump'){ held.jump = true; }
            else if(act === 'fire'){ firing = true; aimUse = false; }
          },
          function(){
            if(act === 'left') held.left = false;
            else if(act === 'right') held.right = false;
            else if(act === 'jump') held.jump = false;
            else if(act === 'fire') firing = false;
          });
      })(btns[bi]);
    }
  }

  cv.addEventListener('pointermove', function(e){
    var r = cv.getBoundingClientRect();
    aimM.x = e.clientX - r.left; aimM.y = e.clientY - r.top;
    aimM.on = true; aimUse = true;
  });
  cv.addEventListener('pointerdown', function(e){
    if(e.pointerType === 'touch'){
      var r = cv.getBoundingClientRect();
      aimM.x = e.clientX - r.left; aimM.y = e.clientY - r.top;
      aimM.on = true; aimUse = true;
      firing = true;
      return;
    }
    firing = true; aimUse = true;
    e.preventDefault();
  });
  window.addEventListener('pointerup', function(){ firing = false; });
  cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });

  function clearInput(){
    held.left = false; held.right = false; held.jump = false; firing = false;
  }

  /* ---------------- player actions ---------------- */
  function startReload(){
    if(!player || player.reload > 0 || player.mag >= player.magMax) return;
    player.reload = 1.05; sfx('reload');
  }
  function shoot(){
    if(state !== 'play' || player.dead) return;
    if(player.reload > 0 || player.cd > 0) return;
    if(player.mag <= 0){ startReload(); return; }
    player.mag--; player.cd = 0.125;
    var bx = player.x + Math.cos(player.ang) * 16;
    var by = player.y - playerH() * 0.72 + Math.sin(player.ang) * 16;
    var spread = (Math.random() - 0.5) * 0.035;
    var sp = 1150;
    bullets.push({ x: bx, y: by, vx: Math.cos(player.ang + spread) * sp, vy: Math.sin(player.ang + spread) * sp,
      life: 0.9, foe: false, dmg: 12, len: 16 });
    for(var i = 0; i < 3; i++) bits.push({ x: bx, y: by, vx: Math.cos(player.ang) * (140 + Math.random() * 260),
      vy: Math.sin(player.ang) * (140 + Math.random() * 260) + (Math.random() - 0.5) * 90, life: 0.16, c: '#ffe9a8', r: 2.4 });
    shake = Math.min(6, shake + 1.4);
    sfx('shoot');
    if(player.mag <= 0) startReload();
    syncHud();
  }

  function playerH(){ return Math.min(124, Math.max(72, H * 0.175)); }

  function hurtPlayer(dmg){
    if(state !== 'play' || player.dead) return;
    player.hp -= dmg; player.flash = 0.2; hurtFlash = 0.35;
    shake = Math.min(14, shake + 4);
    sfx('hurt');
    if(player.hp <= 0){
      player.hp = 0; player.dead = true; endRun();
    }
    syncHud();
  }
  function endRun(){
    state = 'over'; running = false;
    if(score > best){
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch(e){}
    }
    syncHud();
    showPanel('over');
    say('Game over. Score ' + score);
  }

  function killEnemy(e, idx){
    enemies.splice(idx, 1);
    var pts = e.type === 'runner' ? 15 : (e.type === 'shooter' ? 20 : 10);
    combo++; comboT = 3;
    score += pts + Math.min(20, combo * 2);
    for(var i = 0; i < 14; i++){
      bits.push({ x: e.x, y: e.y - 24, vx: (Math.random() - 0.5) * 420, vy: -Math.random() * 380,
        life: 0.7 + Math.random() * 0.4, c: i % 3 ? '#3d4a52' : '#ff7a5c', r: 2 + Math.random() * 2.2, g: 1 });
    }
    sfx('kill');
    syncHud();
  }
  function killBoss(){
    for(var i = 0; i < 46; i++){
      bits.push({ x: boss.x, y: boss.y - 60, vx: (Math.random() - 0.5) * 620, vy: -Math.random() * 520,
        life: 0.9 + Math.random() * 0.6, c: i % 4 ? '#3d4a52' : '#ff5d5d', r: 2.4 + Math.random() * 3, g: 1 });
    }
    score += 200 + wave * 20;
    boss = null;
    if(elBossWrap) elBossWrap.hidden = true;
    sfx('boss');
    shake = 16;
    syncHud();
    breather = 1.6;
  }

  /* ---------------- update ---------------- */
  function step(dt){
    elapsed += dt;
    var ph = playerH();

    /* player move */
    var dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if(dir !== 0) player.face = dir;
    player.vx += (dir * 250 - player.vx) * Math.min(1, dt * 12);
    if(Math.abs(player.vx) < 4) player.vx = 0;
    player.x += player.vx * dt;
    player.x = Math.max(26, Math.min(W - 26, player.x));

    if(held.jump && player.onGround){ player.vy = -620; player.onGround = false; noise(0.05, 0.02); }
    player.vy += 1750 * dt;
    player.y += player.vy * dt;
    if(player.y >= groundY){ player.y = groundY; player.vy = 0; player.onGround = true; }
    player.walk += Math.abs(player.vx) * dt * 0.06;

    /* aim */
    if(aimUse && aimM.on){
      var ax = aimM.x - player.x, ay = aimM.y - (player.y - ph * 0.72);
      player.ang = Math.atan2(ay, ax);
    } else {
      var tgt = nearestEnemy();
      if(tgt){
        var dx = tgt.x - player.x, dy = (tgt.y - (tgt.boss ? 70 : 24)) - (player.y - ph * 0.72);
        player.ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.055;
      } else {
        player.ang = player.face > 0 ? 0 : Math.PI;
      }
    }
    if(player.face > 0 && Math.cos(player.ang) < -0.2) player.face = -1;
    if(player.face < 0 && Math.cos(player.ang) > 0.2) player.face = 1;

    player.cd = Math.max(0, player.cd - dt);
    if(player.reload > 0){
      player.reload -= dt;
      if(player.reload <= 0){ player.reload = 0; player.mag = player.magMax; syncHud(); }
    }
    if(firing) shoot();
    player.flash = Math.max(0, player.flash - dt);

    /* wave pacing */
    if(breather > 0) breather -= dt;
    if(!boss && queue.length && breather <= 0){
      spawnT -= dt;
      if(spawnT <= 0 && enemies.length < Math.min(7, 4 + Math.floor(wave / 2))){
        spawnEnemy(queue.shift());
        spawnT = Math.max(0.35, 1.25 - wave * 0.06);
      }
    }
    if(!boss && !queue.length && !enemies.length && breather <= 0){
      breather = 2.2; nextWave();
    }

    /* enemies */
    var barrage = 3;
    for(var i = enemies.length - 1; i >= 0; i--){
      var e = enemies[i];
      var dist = Math.abs(player.x - e.x);
      e.face = player.x > e.x ? 1 : -1;
      e.cd -= dt;
      e.flash = Math.max(0, e.flash - dt);
      var want = e.type === 'runner' ? 24 : 250;
      if(dist > want){
        e.x += e.face * e.speed * dt;
        e.walk += dt * e.speed * 0.045;
      } else if(e.type === 'runner'){
        if(e.cd <= 0){ hurtPlayer(13); e.cd = 0.95; }
      } else {
        e.walk += dt * 2;
        if(e.cd <= 0){
          e.cd = (e.type === 'shooter' ? 1.5 : 2.0) * Math.max(0.55, 1 - wave * 0.045);
          var shots = e.type === 'shooter' ? barrage : 1;
          fireAt(e, shots, e.type === 'shooter' ? 470 : 400);
        }
      }
      if(Math.abs(e.x - player.x) < 22 && Math.abs(e.y - player.y) < 40){
        if(e.type !== 'runner'){ /* body block: push apart */ e.x -= e.face * 60 * dt; }
      }
    }

    /* boss */
    if(boss){
      boss.walk += dt * 3;
      boss.flash = Math.max(0, boss.flash - dt);
      boss.cd -= dt;
      boss.face = player.x > boss.x ? 1 : -1;
      boss.phase = (boss.phase + dt) % 6;
      var bd = Math.abs(player.x - boss.x);
      if(bd > 300) boss.x += boss.face * 105 * dt;
      else if(bd < 150) boss.x -= boss.face * 80 * dt;
      boss.x = Math.max(96, Math.min(W - 96, boss.x));
      if(boss.cd <= 0){
        var mode = Math.floor(boss.phase / 2) % 3;
        if(mode === 0){ fireAt(boss, 1, 520, 1.15); boss.cd = 1.0; }
        else if(mode === 1){ fireAt(boss, 3, 460, 0.34); boss.cd = 1.7; }
        else { fireAt(boss, 5, 400, 0.9); boss.cd = 2.1; }
      }
      if(bd < 60){ hurtPlayer(18 * dt * 6); }
      if(elBossBar) elBossBar.style.width = Math.max(0, boss.hp / boss.hpMax * 100) + '%';
    }

    /* muzzle flash */
    if(player && player.cd > 0.09 && !player.dead){
      var mx = player.x + Math.cos(player.ang) * ph * 0.5, my = player.y - ph * 0.72 + Math.sin(player.ang) * ph * 0.5;
      var fg = ctx.createRadialGradient(mx, my, 1, mx, my, ph * 0.22);
      fg.addColorStop(0, 'rgba(255,244,200,.95)');
      fg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(mx, my, ph * 0.22, 0, Math.PI * 2); ctx.fill();
    }

    /* bullets */
    for(var b = bullets.length - 1; b >= 0; b--){
      var bl = bullets[b];
      bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
      if(bl.life <= 0 || bl.x < -60 || bl.x > W + 60 || bl.y < -80 || bl.y > H + 40){ bullets.splice(b, 1); continue; }
      if(bl.foe){
        if(Math.abs(bl.x - player.x) < 18 && bl.y > player.y - ph && bl.y < player.y + 6){
          bullets.splice(b, 1); hurtPlayer(bl.dmg);
        }
      } else {
        var hit = false;
        for(var q = 0; q < enemies.length; q++){
          var en = enemies[q];
          if(Math.abs(bl.x - en.x) < 20 && bl.y > en.y - 58 && bl.y < en.y + 4){
            en.hp -= bl.dmg; en.flash = 0.14;
            for(var s2 = 0; s2 < 5; s2++) bits.push({ x: bl.x, y: bl.y, vx: (Math.random() - 0.5) * 260,
              vy: -Math.random() * 200, life: 0.3, c: '#ffd9a0', r: 2, g: 1 });
            if(en.hp <= 0) killEnemy(en, q);
            hit = true; sfx('hit');
            break;
          }
        }
        if(!hit && boss && Math.abs(bl.x - boss.x) < 40 && bl.y > boss.y - 120 && bl.y < boss.y + 6){
          boss.hp -= bl.dmg; boss.flash = 0.12; hit = true; sfx('hit');
          for(var s3 = 0; s3 < 6; s3++) bits.push({ x: bl.x, y: bl.y, vx: (Math.random() - 0.5) * 300,
            vy: -Math.random() * 220, life: 0.35, c: '#ffb0a0', r: 2.2, g: 1 });
          if(boss.hp <= 0) killBoss();
        }
        if(hit) bullets.splice(b, 1);
      }
    }

    /* particles */
    for(var p = bits.length - 1; p >= 0; p--){
      var pt = bits[p];
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if(pt.g) pt.vy += 1400 * dt;
      pt.life -= dt;
      if(pt.life <= 0) bits.splice(p, 1);
    }

    if(comboT > 0){ comboT -= dt; if(comboT <= 0) combo = 0; }
    shake *= Math.pow(0.86, dt * 60);
    hurtFlash = Math.max(0, hurtFlash - dt);
  }

  function nearestEnemy(){
    var best = null, bd = 1e9;
    for(var i = 0; i < enemies.length; i++){
      var d = Math.abs(enemies[i].x - player.x);
      if(d < bd){ bd = d; best = enemies[i]; }
    }
    if(!best && boss) best = boss;
    return best;
  }

  function fireAt(src, count, speed, spread){
    var ty = player.y - playerH() * 0.72;
    var base = Math.atan2(ty - (src.y - (src.boss ? 74 : 30)), player.x - src.x);
    spread = spread || 0.18;
    for(var i = 0; i < count; i++){
      var a = base + (count === 1 ? 0 : (i - (count - 1) / 2) * spread);
      bullets.push({ x: src.x + Math.cos(a) * 20, y: src.y - (src.boss ? 74 : 30) + Math.sin(a) * 20,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1.6, foe: true, dmg: 9, len: 12 });
    }
    sfx('eshot');
  }

  /* ---------------- draw ---------------- */
  function shadow(x, y, w){
    var g = ctx.createRadialGradient(x, y, 1, x, y, w);
    g.addColorStop(0, 'rgba(0,0,0,.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w, w * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSky(){
    var g = ctx.createLinearGradient(0, 0, 0, groundY);
    g.addColorStop(0, '#1b1436');
    g.addColorStop(0.45, '#5a2f4e');
    g.addColorStop(1, '#c96a4e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, groundY + 2);
    /* sun */
    var sy = groundY * 0.62, sx = W * 0.72;
    var sg = ctx.createRadialGradient(sx, sy, 2, sx, sy, Math.max(90, H * 0.3));
    sg.addColorStop(0, 'rgba(255,216,150,.95)');
    sg.addColorStop(0.25, 'rgba(255,150,90,.35)');
    sg.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, groundY);
  }
  function drawSkyline(){
    /* far silhouettes, deterministic from width so it doesn't crawl */
    var base = groundY;
    ctx.fillStyle = 'rgba(26,20,38,.72)';
    var seed = 1;
    var bw = Math.max(46, W / 16);
    for(var x = -20; x < W + 40; x += bw){
      seed = (seed * 9301 + 49297) % 233280;
      var r = seed / 233280;
      var hh = base * (0.18 + r * 0.34);
      ctx.fillRect(x, base - hh, bw * 0.72, hh);
      if(r > 0.55){
        ctx.fillStyle = 'rgba(255,220,170,.16)';
        for(var wy = base - hh + 10; wy < base - 16; wy += 16){
          for(var wx = x + 6; wx < x + bw * 0.62; wx += 14){
            if(((wx + wy) | 0) % 3 === 0) ctx.fillRect(wx, wy, 5, 7);
          }
        }
        ctx.fillStyle = 'rgba(26,20,38,.72)';
      }
    }
  }
  function drawGround(){
    var g = ctx.createLinearGradient(0, groundY, 0, H);
    g.addColorStop(0, '#2a2130');
    g.addColorStop(1, '#15101c');
    ctx.fillStyle = g;
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.strokeStyle = 'rgba(255,190,140,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY + 1); ctx.lineTo(W, groundY + 1); ctx.stroke();
    /* rubble marks */
    ctx.fillStyle = 'rgba(255,255,255,.045)';
    for(var x = 0; x < W; x += 74){
      ctx.fillRect(x + (x % 37), groundY + 16 + (x % 3) * 9, 26, 3);
    }
  }

  function stick(x, y, h, walk, ang, opt){
    opt = opt || {};
    var lw = opt.lw || Math.max(2.2, h * 0.062);
    var hip = y - h * 0.46, sho = y - h * 0.76, headR = h * 0.14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = opt.color || '#f4f7f5';
    ctx.lineWidth = lw;
    /* legs */
    var swing = opt.moving ? Math.sin(walk) * h * 0.16 : 0;
    var lift = opt.moving ? Math.abs(Math.cos(walk)) * h * 0.05 : 0;
    ctx.beginPath();
    ctx.moveTo(x, hip); ctx.lineTo(x - h * 0.06 + swing, y - lift);
    ctx.moveTo(x, hip); ctx.lineTo(x + h * 0.06 - swing, y - lift);
    ctx.stroke();
    /* spine */
    ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x, sho); ctx.stroke();
    /* arm aiming */
    var ax = Math.cos(ang), ay = Math.sin(ang);
    var ar = h * 0.34;
    ctx.beginPath();
    ctx.moveTo(x, sho); ctx.lineTo(x + ax * ar, sho + ay * ar);
    ctx.stroke();
    /* back arm */
    ctx.beginPath();
    ctx.moveTo(x, sho); ctx.lineTo(x - ax * ar * 0.55 + swing * 0.4, sho + h * 0.22);
    ctx.stroke();
    /* head */
    ctx.fillStyle = opt.head || opt.color || '#f4f7f5';
    ctx.beginPath(); ctx.arc(x + ax * 2, sho - headR * 1.05, headR, 0, Math.PI * 2); ctx.fill();
    if(opt.eyes){
      ctx.fillStyle = opt.eyes;
      ctx.beginPath();
      ctx.arc(x + ax * 2 + Math.sign(ax || 1) * headR * 0.35, sho - headR * 1.15, headR * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    if(opt.scarf){
      ctx.strokeStyle = opt.scarf;
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, sho + 2);
      ctx.quadraticCurveTo(x - Math.sign(ax || 1) * h * 0.2, sho + h * 0.06, x - Math.sign(ax || 1) * h * 0.3, sho + h * 0.02);
      ctx.stroke();
    }
  }

  function draw(){
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var sx = (Math.random() - 0.5) * shake, sy2 = (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(sx, sy2);
    drawSky();
    drawSkyline();
    drawGround();

    var ph = playerH();

    /* enemies */
    for(var i = 0; i < enemies.length; i++){
      var e = enemies[i];
      var eh = geth(e);
      ctx.globalAlpha = 1;
      shadow(e.x, e.y, eh * 0.42);
      ctx.save();
      if(e.flash > 0){ ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; }
      stick(e.x, e.y, eh, e.walk, Math.atan2((player.y - ph * 0.7) - (e.y - eh * 0.6), player.x - e.x),
        { moving: Math.abs(player.x - e.x) > 30, color: e.flash > 0 ? '#ffffff' : '#93a3ab', head: e.flash > 0 ? '#fff' : '#849499',
          eyes: e.type === 'runner' ? '#ff4d3d' : '#ffb057', lw: Math.max(2.4, eh * 0.062) });
      ctx.restore();
      /* hp tick */
      if(e.hp < e.hpMax){
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(e.x - 16, e.y - eh - 12, 32, 4);
        ctx.fillStyle = '#8df7bb';
        ctx.fillRect(e.x - 16, e.y - eh - 12, 32 * Math.max(0, e.hp / e.hpMax), 4);
      }
    }

    /* boss */
    if(boss){
      var bh = Math.max(170, H * 0.34);
      shadow(boss.x, boss.y, bh * 0.4);
      ctx.save();
      ctx.shadowColor = 'rgba(255,80,80,.75)'; ctx.shadowBlur = 26;
      stick(boss.x, boss.y, bh, boss.walk, Math.atan2((player.y - ph * 0.7) - (boss.y - bh * 0.7), player.x - boss.x),
        { moving: true, color: boss.flash > 0 ? '#ffffff' : '#e9e2d6', head: boss.flash > 0 ? '#fff' : '#e9e2d6',
          eyes: '#ff3b3b', lw: Math.max(4, bh * 0.055), scarf: 'rgba(255,70,70,.85)' });
      ctx.restore();
    }

    /* player */
    if(player && !player.dead){
      var ang = player.ang;
      shadow(player.x, player.y, ph * 0.4);
      stick(player.x, player.y, ph, player.walk, ang, {
        moving: Math.abs(player.vx) > 12, color: player.flash > 0 ? '#ffb3a8' : '#ffffff',
        head: '#ffffff', eyes: '#8df7bb', scarf: 'rgba(141,247,187,.9)', lw: Math.max(2.4, ph * 0.062)
      });
      /* gun */
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = Math.max(2, ph * 0.05);
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(ang) * ph * 0.28, player.y - ph * 0.72 + Math.sin(ang) * ph * 0.28);
      ctx.lineTo(player.x + Math.cos(ang) * ph * 0.46, player.y - ph * 0.72 + Math.sin(ang) * ph * 0.46);
      ctx.stroke();
    }

    /* bullets */
    for(var b = 0; b < bullets.length; b++){
      var bl = bullets[b];
      var sp = Math.sqrt(bl.vx * bl.vx + bl.vy * bl.vy) || 1;
      var ux = bl.vx / sp, uy = bl.vy / sp;
      ctx.strokeStyle = bl.foe ? 'rgba(255,110,90,.95)' : 'rgba(255,240,190,.95)';
      ctx.lineWidth = bl.foe ? 3 : 2.4;
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(bl.x - ux * bl.len, bl.y - uy * bl.len);
      ctx.stroke();
    }

    /* particles */
    for(var p = 0; p < bits.length; p++){
      var pt = bits[p];
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2.2));
      ctx.fillStyle = pt.c;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* edge vignette */
    var vg = ctx.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.32, W / 2, H * 0.52, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,2,8,.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    /* hurt vignette */
    if(hurtFlash > 0){
      ctx.fillStyle = 'rgba(255,60,60,' + (hurtFlash * 0.35) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    /* combo */
    if(combo > 2 && comboT > 0){
      ctx.fillStyle = 'rgba(141,247,187,.9)';
      ctx.font = '600 ' + Math.round(Math.min(26, H * 0.045)) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('x' + combo, W / 2, H * 0.16);
    }
    if(state === 'intro'){
      /* idle ambience behind the intro panel */
      ctx.fillStyle = 'rgba(8,10,14,.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }
  function geth(e){ return Math.min(108, Math.max(62, H * 0.152)); }

  /* ---------------- loop ---------------- */
  function loop(t){
    raf = requestAnimationFrame(loop);
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
    lastT = t;
    if(layer.hidden) return;
    if(state === 'play' && running) step(dt);
    draw();
  }

  /* ---------------- open / close ---------------- */
  function openEzs(){
    layer.hidden = false;
    document.body.style.overflow = 'hidden';
    size(); reset();
    state = 'intro'; running = false;
    showPanel('intro');
    if(!raf) raf = requestAnimationFrame(loop);
    var m = pMain; if(m) m.focus();
    say('EZS arena ready');
  }
  function closeEzs(){
    layer.hidden = true;
    state = 'intro'; running = false;
    clearInput();
    if(raf){ cancelAnimationFrame(raf); raf = 0; }
    /* back to the arcade menu it was launched from, focus on the EZS card */
    var tgl = document.getElementById('testToggle');
    var arcade = document.getElementById('gameLayer');
    if(tgl && arcade && arcade.hidden){ try{ tgl.click(); }catch(e){} }
    document.body.style.overflow = '';
    setTimeout(function(){
      var card = document.querySelector('.pickcard[data-game="ezs"]');
      if(card && card.offsetParent !== null) card.focus();
    }, 40);
    say('Left EZS');
  }
  function togglePause(){
    if(state === 'play'){ state = 'pause'; running = false; showPanel('pause'); clearInput(); say('Paused'); }
    else if(state === 'pause'){ state = 'play'; running = true; hidePanel(); lastT = 0; say('Resumed'); }
  }

  /* ---------------- wiring ---------------- */
  if(pMain) pMain.addEventListener('click', function(){
    if(state === 'intro' || state === 'over') startRun();
    else if(state === 'pause') togglePause();
  });
  if(pAlt) pAlt.addEventListener('click', function(){ closeEzs(); });
  var xBtn = document.getElementById('ezsExit');
  if(xBtn) xBtn.addEventListener('click', closeEzs);
  var pauseBtn = document.getElementById('ezsPause');
  if(pauseBtn) pauseBtn.addEventListener('click', function(){ if(state === 'play' || state === 'pause') togglePause(); });
  if(sndBtn) sndBtn.addEventListener('click', function(){
    soundOn = !soundOn;
    sndBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    sndBtn.textContent = soundOn ? '♪' : '♪̸';
  });
  document.addEventListener('keydown', keyDown, {passive: false});
  document.addEventListener('keyup', keyUp);
  window.addEventListener('resize', function(){ if(!layer.hidden){ size(); } });
  window.addEventListener('blur', clearInput);
  if(document.addEventListener){
    document.addEventListener('visibilitychange', function(){ if(document.hidden) clearInput(); });
  }

  /* ---------------- public hooks (tests) ---------------- */
  window.__ezs = {
    open: openEzs,
    close: closeEzs,
    start: startRun,
    pause: function(v){
      if(v === undefined) return state === 'pause';
      if(v && state === 'play') togglePause();
      else if(!v && state === 'pause') togglePause();
      return state;
    },
    state: function(){
      return {
        state: state, running: running, wave: wave, score: score, best: best,
        hp: player ? Math.round(player.hp) : 0, ammo: player ? player.mag : 0,
        enemies: enemies.length, queued: queue.length, boss: boss ? Math.round(boss.hp) : 0,
        bullets: bullets.length, dead: player ? !!player.dead : true
      };
    },
    wave: function(n){ if(typeof n === 'number'){ wave = n - 1; } nextWave(); return wave; },
    spawn: function(n, type){
      n = n || 1;
      for(var i = 0; i < n; i++) spawnEnemy(type || 'grunt');
      return enemies.length;
    },
    bossNow: function(){ wave = 4; nextWave(); return !!boss; },
    killAll: function(){
      var k = 0;
      while(enemies.length){ killEnemy(enemies[0], 0); k++; }
      if(boss) { boss.hp = 1; killBoss(); k++; }
      return k;
    },
    hurt: function(n){ hurtPlayer(n || 10); return player.hp; },
    fire: function(v){ firing = !!v; return firing; },
    aimAuto: function(){ aimUse = false; return true; },
    score: function(n){ if(typeof n === 'number') score = n; return score; },
    player: function(){ return player ? { x: Math.round(player.x), y: Math.round(player.y), hp: player.hp } : null; }
  };
})();
