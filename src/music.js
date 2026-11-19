<script>/* ---------- soundtrack: two tracks, long-press the pill to pick ---------- */
(function(){
  var btn = document.getElementById('musicBtn');
  if(!btn) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if(!AC){ btn.hidden = true; return; }

  /* your own files, embedded as data: URIs so the page stays a single file */
  var DATA = {
    nostalgia: { name: 'Nostalgia', len: '2:00', b64: '__NOSTALGIA_B64__' },
    og:        { name: 'OG',        len: '1:22', b64: '__OG_B64__' },
    legacy:    { name: 'Legacy',    len: '2:31', b64: '__LEGACY_B64__' }
  };
  var ORDER = ['nostalgia', 'og', 'legacy'];
  var MKEY = 'evorez_music', TKEY = 'evorez_track';
  var DEFAULT_TRACK = 'nostalgia';

  var ctx = null, master = null, src = null, buf = {}, on = false, tok = 0;
  function get(k, d){ try{ var v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } }
  function set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  var cur = DATA[get(TKEY, DEFAULT_TRACK)] ? get(TKEY, DEFAULT_TRACK) : DEFAULT_TRACK;

  /* ---- audio graph ---- */
  function ensure(){
    if(ctx) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }

  function toBuf(b64){
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for(var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  function decode(id){
    if(buf[id]) return Promise.resolve(buf[id]);
    ensure();
    return new Promise(function(res, rej){
      /* decodeAudioData copies the buffer, so the array can be handed straight over */
      ctx.decodeAudioData(toBuf(DATA[id].b64), res, rej);
    }).then(function(b){ buf[id] = b; return b; });
  }

  function killSrc(){
    if(!src) return;
    try{ src.stop(); }catch(e){}
    try{ src.disconnect(); }catch(e){}
    src = null;
  }

  function fadeIn(){
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(1, now + 1.1);
  }

  function start(){
    ensure();
    if(ctx.state !== 'running'){ try{ ctx.resume(); }catch(e){} }
    var id = cur, mine = ++tok;
    decode(id).then(function(b){
      if(mine !== tok) return;                       /* a newer pick won */
      killSrc();
      src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      src.connect(master);
      src.start(0);
      on = true;
      paint();
      fadeIn();
      set(MKEY, '1');
    }).catch(function(){ /* undecodable: stay silent, never throw */ });
  }

  function stop(){
    on = false;
    paint();
    set(MKEY, '0');
    if(!ctx) return;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    setTimeout(function(){
      if(on) return;
      killSrc();
      if(ctx && ctx.state === 'running'){ try{ ctx.suspend(); }catch(e){} }
    }, 640);
  }

  function swap(){
    if(!ctx) return;
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    setTimeout(function(){ if(on) start(); }, 240);
  }

  function play(id){
    if(!DATA[id] || id === cur) return;
    cur = id;
    set(TKEY, id);
    paintMenu();
    paint();
    if(on) swap();
  }

  /* ---- the pill ---- */
  function paint(){
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    var label = (on ? 'Music: on \u00b7 ' : 'Music: ') + DATA[cur].name;
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }

  /* ---- the soundtrack menu (island that grows out of the pill) ---- */
  var pop = document.getElementById('trackPop');
  var scrim = document.getElementById('scrim');
  var open = false, hideT = null;

  function setScrim(state){
    if(!scrim) return;
    if(state){
      scrim.hidden = false;
      requestAnimationFrame(function(){ scrim.classList.add('is-open'); });
    } else {
      scrim.classList.remove('is-open');
      setTimeout(function(){ if(!scrim.classList.contains('is-open')) scrim.hidden = true; }, 320);
    }
  }

  function openPop(){
    if(!pop || open) return;
    /* the appearance card and this one share the pill: never both at once */
    var ap = document.getElementById('appearPop');
    if(ap && !ap.hidden){
      var ab = document.getElementById('appearBtn');
      if(ab) ab.click();
    }
    open = true;
    clearTimeout(hideT);
    btn.setAttribute('aria-expanded', 'true');
    setScrim(true);
    pop.hidden = false;
    void pop.offsetWidth;                        /* force a frame so the morph runs */
    pop.classList.add('is-open');
    var first = pop.querySelector('.titem');
    if(first) try{ first.focus({ preventScroll: true }); }catch(e){}
  }

  function closePop(){
    if(!pop || !open) return;
    open = false;
    btn.setAttribute('aria-expanded', 'false');
    pop.classList.remove('is-open');
    setScrim(false);
    hideT = setTimeout(function(){ if(!open) pop.hidden = true; }, 320);
  }

  function paintMenu(){
    if(!pop) return;
    var items = pop.querySelectorAll('.titem');
    for(var i = 0; i < items.length; i++){
      var id = items[i].getAttribute('data-track');
      var on2 = id === cur;
      items[i].classList.toggle('is-on', on2);
      items[i].setAttribute('aria-pressed', String(on2));
    }
  }

  if(pop){
    pop.addEventListener('click', function(e){
      var it = e.target.closest ? e.target.closest('.titem') : null;
      if(!it) return;
      play(it.getAttribute('data-track'));
      if(!on) start();
      closePop();
      btn.focus({ preventScroll: true });
    });
  }

  if(scrim) scrim.addEventListener('click', function(){ closePop(); });

  document.addEventListener('pointerdown', function(e){
    if(!open) return;
    if(e.target === btn || btn.contains(e.target)) return;
    if(pop && pop.contains(e.target)) return;
    closePop();
  }, true);

  document.addEventListener('keydown', function(e){
    if(!open) return;
    if(e.key === 'Escape'){ closePop(); btn.focus({ preventScroll: true }); return; }
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      var items = Array.prototype.slice.call(pop.querySelectorAll('.titem'));
      var i = items.indexOf(document.activeElement);
      if(i === -1) return;
      e.preventDefault();
      var n = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[n].focus({ preventScroll: true });
    }
  });

  /* ---- long press opens it, tap plays/pauses ---- */
  var pressT = null, held = false;
  function pressDown(e){
    if(e && e.button !== undefined && e.button > 0) return;
    held = false;
    btn.classList.add('is-press');
    clearTimeout(pressT);
    pressT = setTimeout(function(){
      held = true;
      btn.classList.remove('is-press');
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
      openPop();
    }, 460);
  }
  function pressUp(){
    clearTimeout(pressT);
    btn.classList.remove('is-press');
  }

  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'trackPop');

  btn.addEventListener('pointerdown', pressDown);
  btn.addEventListener('pointerup', pressUp);
  btn.addEventListener('pointerleave', pressUp);
  btn.addEventListener('pointercancel', pressUp);
  btn.addEventListener('click', function(e){
    if(held){ held = false; e.preventDefault(); return; }          /* the long press already acted */
    if(on && ctx && ctx.state !== 'running'){                     /* autoplay was blocked: this tap unlocks audio */
      try{ ctx.resume(); }catch(err){}
      return;
    }
    if(on) stop(); else start();
  });
  btn.addEventListener('contextmenu', function(e){ e.preventDefault(); openPop(); });
  btn.addEventListener('keydown', function(e){
    if(e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ContextMenu'){
      e.preventDefault();
      openPop();
    }
  });

  /* ---- default: Nostalgia, silent ---- */
  paintMenu();
  paint();
  /* music never starts on its own: no autoplay, no first-gesture start, no resume from
     storage. The pill is the only way in. */

  window.__music = {
    toggle: function(){ if(on) stop(); else start(); },
    pick: function(id){ play(id); if(!on) start(); },
    open: openPop, close: closePop,
    state: function(){
      return { on: on, track: cur, ctx: ctx ? ctx.state : null,
        gain: master ? +master.gain.value.toFixed(3) : 0,
        src: !!src, menu: open ? 'open' : 'closed',
        len: buf[cur] ? +buf[cur].duration.toFixed(2) : null,
        saved: get(MKEY, null), savedTrack: get(TKEY, null) };
    },
    tracks: ORDER.slice()
  };
})();</script>
