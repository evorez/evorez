#!/usr/bin/env python3
"""Rebuild index.html with every game removed.

Removes: MATRIX RUN + SNAKE (arcade script), NEON NAGAR (city markup + script + CSS),
EZS (markup + script + CSS). Keeps the shell: hero, terminal, appearance, rain.
The TESTING toggle now opens an arcade layer that shows a loading bar and then a
"no games yet" panel.

Run:  python3 build_stripped.py            (writes index.stripped.html, then swaps in)
"""
import base64
import re
import sys

SRC = 'archive/index-full-games-final.html'
OUT = 'index.stripped.html'


def div_span(s, id_attr):
    """Return (start, end) of the element whose opening tag carries id="id_attr"."""
    m = re.search(r'<(\w+)\b[^>]*\bid="%s"' % re.escape(id_attr), s)
    if not m:
        raise SystemExit('element not found: ' + id_attr)
    start = s.rfind('<', 0, m.start() + 1)
    tag = m.group(1)
    # walk forward over tags of the same name, tracking depth
    depth = 0
    pat = re.compile(r'<(/?)%s\b[^>]*>' % tag, re.S)
    pos = start
    while True:
        t = pat.search(s, pos)
        if not t:
            raise SystemExit('unbalanced element: ' + id_attr)
        if t.group(1) == '/':
            depth -= 1
            if depth == 0:
                return start, t.end()
        else:
            if not t.group(0).rstrip('>').endswith('/'):
                depth += 1
        pos = t.end()


def script_span(s, needle):
    """Return (start, end) of the <script> block containing `needle`."""
    for m in re.finditer(r'<script\b[^>]*>.*?</script>', s, re.S):
        if needle in m.group(0):
            return m.start(), m.end()
    raise SystemExit('script not found: ' + needle)


def cut(s, span, label, log):
    a, b = span
    # swallow surrounding blank lines/indentation
    while a > 0 and s[a - 1] in ' \t':
        a -= 1
    if a > 0 and s[a - 1] == '\n':
        a -= 1
    log.append('%-28s -%d bytes' % (label, b - a))
    return s[:a] + s[b:]


OVERLAY = '''<div class="game" id="gameLayer" hidden>
  <div class="game__box" role="dialog" aria-modal="true" aria-labelledby="gameTitle" aria-describedby="arcStatus">
    <div class="game__bar">
      <span id="gameTitle">arcade<b>.exe</b></span>
      <button class="game__x" id="gameClose" type="button" aria-label="Close arcade">\u2715</button>
    </div>
    <div class="arc" id="arc" data-phase="load">
      <div class="arc__load">
        <p class="arc__h" id="arcLabel">loading games</p>
        <div class="arc__bar" id="arcBar" role="progressbar" aria-labelledby="arcLabel"
             aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
        <p class="arc__pct" id="arcPct">0%</p>
      </div>
      <div class="arc__soon">
        <p class="arc__h">no games yet</p>
        <p class="arc__sub">everything was taken down \u2014 the arcade is being rebuilt from scratch.
          first drop lands right here.</p>
        <button class="game__play" id="arcBack" type="button">BACK</button>
      </div>
      <p class="arc__sr" id="arcStatus" role="status" aria-live="polite"></p>
    </div>
  </div>
</div>
'''


ROMAN_CSS = """
/* ---------- the line: All Eyes On You (embedded roman serif, 3.4 KB) ---------- */
@font-face{font-family:'Evorez Roman';src:url(data:font/woff2;base64,__FONT__) format('woff2');
  font-weight:400;font-style:normal;font-display:swap}
/* 0.9 KB slice of Noto Color Emoji (OFL 1.1) so the eyes render on devices with no emoji font */
@font-face{font-family:'Evorez Eyes';src:url(data:font/woff2;base64,__EYES__) format('woff2');
  font-weight:400;font-style:normal;font-display:swap;unicode-range:U+1F440}
.rome{margin:20px 0 2px;font-family:'Evorez Roman','Times New Roman',Times,Georgia,serif;
  text-transform:uppercase;font-size:clamp(19px,3.4vw,29px);line-height:1.32;letter-spacing:.15em;
  color:#f4fff9;text-shadow:0 0 34px rgba(var(--green-rgb),.34),0 1px 0 rgba(255,255,255,.06)}
.rome__e{display:inline-block;margin-left:.34em;font-family:'Evorez Eyes','Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;
  font-size:.84em;letter-spacing:0;text-shadow:none;transform:translateY(1px)}
html[data-theme="light"] .rome{color:#0b1a12;text-shadow:0 0 26px rgba(var(--green-rgb),.22)}
@media (prefers-reduced-motion:no-preference){.rome{animation:romeIn .8s cubic-bezier(.2,.7,.2,1) both}}
@keyframes romeIn{from{opacity:0;letter-spacing:.3em}to{opacity:1;letter-spacing:.15em}}
.rome__dots{display:inline-flex;margin-left:.04em}
.rome__dots i{font-style:normal;opacity:.22;animation:romeDot 1.5s ease-in-out infinite}
.rome__dots i:nth-child(2){animation-delay:.18s}
.rome__dots i:nth-child(3){animation-delay:.36s}
@keyframes romeDot{0%,75%,100%{opacity:.2}35%{opacity:1}}
@media (prefers-reduced-motion:reduce){.rome__dots i{animation:none;opacity:.65}}
@media (max-width:560px){.rome{letter-spacing:.12em}}
"""

ROMAN_OLD = ('<p class="sub">Nothing has shipped yet \u2014 no fake dashboards, no borrowed screenshots. '
             "I'm building in the open, and the moment something real exists, it lands <b>right here</b>.</p>")
ROMAN_NEW = ('<p class="rome">All Eyes On You'
             '<span class="rome__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span> '
             '<span class="rome__e" aria-hidden="true">\U0001F440</span></p>')

DOCK_CSS = r'''
/* ---------- floating iOS dock: every nav icon lives in one pill ---------- */
.dock{position:fixed;left:50%;bottom:calc(21px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:70;
  padding:7px;border-radius:999px;display:flex;align-items:center;
  background:rgba(10,18,14,.44);border:1px solid rgba(150,255,200,.16);
  backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);
  box-shadow:0 22px 60px -26px rgba(0,0,0,.95),inset 0 1px 0 rgba(255,255,255,.14)}
.dock .links{margin:0;display:flex;align-items:center;gap:5px;flex-wrap:nowrap}
.dock .lnk,.dock .iconbtn,.dock .termbtn,.dock .tgl{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);
  box-shadow:none;border-radius:999px;height:40px;color:rgba(226,244,232,.86)}
.dock .iconbtn,.dock .lnk,.dock .termbtn{width:40px;padding:0}
.dock .lnk,.dock .termbtn{justify-content:center;font-size:0}
.dock .lnk svg,.dock .termbtn svg{width:18px;height:18px}
.dock .tgl{height:40px;padding:0 12px 0 13px;gap:8px}
.dock .lnk:hover,.dock .iconbtn:hover,.dock .termbtn:hover,.dock .tgl:hover{background:rgba(255,255,255,.13);color:#eafff2;transform:translateY(-2px)}
.dock .iconbtn:active,.dock .lnk:active,.dock .termbtn:active,.dock .tgl:active{transform:scale(.94)}
.dock .pop{position:fixed;top:auto;bottom:calc(99px + env(safe-area-inset-bottom,0px));left:50%;right:auto;
  z-index:90;animation:none;
  /* dynamic-island morph: the card is pulled out of the pill, then settles */
  transform-origin:50% calc(100% + 54px);
  border-radius:999px;
  transform:translateX(-50%) translateY(6px) scale(.32,.18);
  opacity:0;filter:blur(6px);
  transition:transform .42s cubic-bezier(.18,1.42,.36,1), opacity .22s ease-out, border-radius .42s cubic-bezier(.18,1.42,.36,1), filter .28s ease-out}
.dock .pop.is-open{transform:translateX(-50%) translateY(0) scale(1);opacity:1;filter:blur(0);border-radius:18px}
@media (prefers-reduced-motion:reduce){
  .dock .pop{transition:opacity .15s linear;transform:translateX(-50%);border-radius:18px;filter:none}
  .dock .pop.is-open{transform:translateX(-50%)}
}
.shell{padding-bottom:118px}
html[data-theme="light"] .dock{background:rgba(255,255,255,.6);border-color:rgba(10,21,16,.1);
  box-shadow:0 22px 60px -30px rgba(10,21,16,.5),inset 0 1px 0 #fff}
html[data-theme="light"] .dock .lnk,html[data-theme="light"] .dock .iconbtn,html[data-theme="light"] .dock .termbtn,html[data-theme="light"] .dock .tgl{
  background:rgba(255,255,255,.72);border-color:rgba(10,21,16,.1);color:rgba(16,38,26,.8)}
@media (max-width:560px){
  .dock{padding:6px;bottom:calc(17px + env(safe-area-inset-bottom,0px))}
  .dock .links{gap:4px}
  .dock .iconbtn,.dock .lnk,.dock .termbtn{width:37px;height:37px}
  .dock .tgl{height:37px;padding:0 10px}
  .dock .pop{bottom:calc(87px + env(safe-area-inset-bottom,0px))}
  .shell{padding-bottom:104px}
}
'''

MUSIC_CSS = r'''
/* ---------- music toggle (procedural, no audio files) ---------- */
.musbtn{position:relative}
.musbtn__eq{position:absolute;right:0;bottom:-1px;display:none;gap:1.5px;align-items:flex-end;height:9px}
.musbtn.is-on{color:var(--green-bright);border-color:rgba(var(--green-rgb),.5);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 18px -6px rgba(var(--green-rgb),.9)}
.musbtn.is-on .musbtn__eq{display:flex}
.musbtn__eq i{display:block;width:2px;border-radius:1px;background:currentColor;animation:eq 900ms ease-in-out infinite}
.musbtn__eq i:nth-child(1){height:4px;animation-delay:-120ms}
.musbtn__eq i:nth-child(2){height:9px;animation-delay:-380ms}
.musbtn__eq i:nth-child(3){height:6px;animation-delay:-620ms}
@keyframes eq{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.musbtn__eq i{animation:none}}
'''

ARCADE_CSS = '''
/* ---------- arcade: empty for now (loader -> nothing to play) ---------- */
.arc{flex:1 1 auto;padding:40px 26px;display:grid;place-items:center;align-content:center;text-align:center;min-height:220px}
.arc__load,.arc__soon{display:grid;place-items:center;width:100%}
.arc[data-phase="load"] .arc__soon,.arc[data-phase="soon"] .arc__load{display:none}
.arc__h{margin:0;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(var(--gb-rgb),.8)}
.arc__bar{margin:18px 0 10px;width:min(320px,68vw);height:6px;border-radius:99px;
  background:rgba(var(--gb-rgb),.14);overflow:hidden}
.arc__bar i{display:block;height:100%;width:100%;border-radius:99px;transform:scaleX(0);transform-origin:left center;
  background:linear-gradient(90deg,rgba(var(--green-rgb),.7),var(--green-bright));
  box-shadow:0 0 14px rgba(var(--green-rgb),.5);transition:transform .18s linear}
.arc__pct{margin:0;font-size:11px;letter-spacing:.14em;font-variant-numeric:tabular-nums;
  color:rgba(200,230,212,.55)}
.arc__sub{margin:16px auto 0;max-width:34ch;font-size:12.5px;line-height:1.7;color:rgba(200,230,212,.62)}
.arc__soon .game__play{margin-top:22px}
.arc__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
html[data-theme="light"] .arc__h{color:rgba(var(--green-rgb),.85)}
@media (prefers-reduced-motion:reduce){.arc__bar i{transition:none}}
'''

ARCADE_JS = '''<script>/* ============ arcade: loader -> no games yet (all games removed) ============ */
(function(){
  var tgl = document.getElementById('testToggle');
  var layer = document.getElementById('gameLayer');
  if(!tgl || !layer) return;
  var arc = document.getElementById('arc');
  var bar = document.getElementById('arcBar');
  var fill = bar ? bar.firstElementChild : null;
  var pct = document.getElementById('arcPct');
  var status = document.getElementById('arcStatus');
  var back = document.getElementById('arcBack');
  var closeBtn = document.getElementById('gameClose');
  var timer = null, value = 0, returnTo = null, open = false;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function paint(v){
    value = v;
    if(fill) fill.style.transform = 'scaleX(' + (v / 100) + ')';
    if(bar) bar.setAttribute('aria-valuenow', String(Math.round(v)));
    if(pct) pct.textContent = Math.round(v) + '%';
  }
  function soon(){
    if(timer){ clearInterval(timer); timer = null; }
    paint(100);
    arc.setAttribute('data-phase', 'soon');
    if(status) status.textContent = 'no games yet. the arcade is being rebuilt.';
    if(back) back.focus();
  }
  function run(){
    paint(0);
    arc.setAttribute('data-phase', 'load');
    if(status) status.textContent = 'loading games';
    if(reduce){ soon(); return; }
    var step = 2.6;
    timer = setInterval(function(){
      paint(Math.min(100, value + step * (0.7 + Math.random() * 0.9)));
      if(value >= 100) soon();
    }, 42);
  }
  function close(){
    if(timer){ clearInterval(timer); timer = null; }
    open = false;
    layer.hidden = true;
    tgl.setAttribute('aria-pressed', 'false');
    var t = returnTo || tgl;
    returnTo = null;
    if(t && t.focus) t.focus();
  }
  function openArcade(){
    returnTo = document.activeElement;
    open = true;
    layer.hidden = false;
    tgl.setAttribute('aria-pressed', 'true');
    run();
    if(closeBtn) closeBtn.focus();
  }

  tgl.addEventListener('click', function(){ if(open) close(); else openArcade(); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(back) back.addEventListener('click', close);
  document.addEventListener('keydown', function(e){
    if(!open) return;
    if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if(e.key === 'Tab'){
      var ring = [closeBtn, back].filter(function(el){ return el && el.offsetParent !== null; });
      if(!ring.length) return;
      var i = ring.indexOf(document.activeElement);
      if(e.shiftKey && (i <= 0)){ e.preventDefault(); ring[ring.length - 1].focus(); }
      else if(!e.shiftKey && (i === -1 || i === ring.length - 1)){ e.preventDefault(); ring[0].focus(); }
    }
  });
  window.__arcade = { open: openArcade, close: close, phase: function(){ return arc.getAttribute('data-phase'); },
    rewind: function(){ settle(); } };
  function settle(){ paint(100); arc.setAttribute('data-phase', 'soon'); }
})();</script>
'''


MUSIC_MARKUP = '''<button class="iconbtn musbtn" id="musicBtn" type="button" aria-pressed="false" aria-label="Music: off" title="Music">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V6.8l9-1.8v10.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.7"/><circle cx="15.6" cy="15.5" r="2.5" stroke="currentColor" stroke-width="1.7"/></svg>
          <span class="musbtn__eq" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
        '''

TRACK_CSS = r"""
/* ---------- island popovers: morph out of the pill + blurred backdrop ---------- */
/* the card keeps ONE shape: same radius, uniform scale, monotonic easing —
   it rises out of the pill and settles, nothing goes square and nothing wobbles */
.island{position:fixed;top:auto;bottom:calc(99px + env(safe-area-inset-bottom,0px));left:50%;right:auto;z-index:90;
  animation:none;border-radius:18px;transform-origin:50% calc(100% + 61px);
  transform:translateX(-50%) translateY(10px) scale(.94);
  opacity:0;filter:blur(3px);
  will-change:transform,opacity;
  transition:transform .32s cubic-bezier(.22,.68,.2,1),opacity .16s ease-out,filter .2s ease-out}
.island.is-open{transform:translateX(-50%) translateY(0) scale(1);opacity:1;filter:blur(0)}
@media (max-width:560px){.island{bottom:calc(87px + env(safe-area-inset-bottom,0px))}}
@media (prefers-reduced-motion:reduce){
  .island{transition:opacity .15s linear;transform:translateX(-50%);filter:none}
  .island.is-open{transform:translateX(-50%)}
}
.scrim{position:fixed;inset:0;z-index:69;background:rgba(4,10,7,.4);opacity:0;
  -webkit-backdrop-filter:blur(14px) saturate(130%);backdrop-filter:blur(14px) saturate(130%);
  transition:opacity .3s ease-out;pointer-events:none}
.scrim.is-open{opacity:1;pointer-events:auto}
html[data-theme="light"] .scrim{background:rgba(244,252,247,.42)}
html[data-blur="deep"] .scrim{-webkit-backdrop-filter:blur(20px) saturate(140%);backdrop-filter:blur(20px) saturate(140%)}
/* ---------- motion: one easing curve, compositor friendly ---------- */
:root{--e-out:cubic-bezier(.22,.68,.2,1);--e-inout:cubic-bezier(.4,0,.2,1)}
.dock,.dock .iconbtn,.dock .lnk,.dock .termbtn,.dock .tgl,.island,.scrim,.titem{backface-visibility:hidden}
.dock .iconbtn,.dock .lnk,.dock .termbtn,.dock .tgl{
  transition:background .18s ease,color .18s ease,transform .22s var(--e-out),box-shadow .22s ease}
.titem{transition:background .18s ease,border-color .18s ease,transform .22s var(--e-out)}
.titem:active{transform:scale(.985)}
.tpop__eq i,.musbtn__eq i{will-change:transform}
/* ---------- soundtrack menu ---------- */
.tpop{width:min(272px,calc(100vw - 24px));padding:10px}
.tpop__h{margin:4px 8px 8px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(var(--gb-rgb),.6)}
.titem{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:12px;
  border:1px solid transparent;background:transparent;color:rgba(226,244,232,.84);
  cursor:pointer;text-align:left;font:inherit;font-size:13px;transition:background .15s,border-color .15s}
.titem:hover{background:rgba(255,255,255,.07)}
.titem__w{display:block;min-width:0}
.titem__n{display:block;font-size:13px;letter-spacing:.05em}
.titem__m{display:block;margin-top:2px;font-size:10.5px;letter-spacing:.1em;
  color:rgba(200,230,212,.5);font-variant-numeric:tabular-nums}
.titem.is-on{background:rgba(var(--green-rgb),.1);border-color:rgba(var(--green-rgb),.36)}
.titem.is-on .titem__n{color:#eafff2}
.tpop__eq{flex:0 0 14px;display:flex;align-items:flex-end;gap:2px;height:12px;opacity:0;color:var(--green-bright)}
.tpop__eq i{display:block;width:2.5px;border-radius:2px;background:currentColor;animation:eq 900ms ease-in-out infinite}
.tpop__eq i:nth-child(1){height:5px;animation-delay:-120ms}
.tpop__eq i:nth-child(2){height:11px;animation-delay:-380ms}
.tpop__eq i:nth-child(3){height:7px;animation-delay:-620ms}
.titem.is-on .tpop__eq{opacity:1}
.tpop__f{margin:8px 8px 2px;font-size:10px;letter-spacing:.06em;color:rgba(200,230,212,.42)}
html[data-theme="light"] .titem{color:rgba(16,38,26,.82)}
html[data-theme="light"] .titem__m{color:rgba(16,38,26,.45)}
html[data-theme="light"] .titem.is-on{background:rgba(10,120,70,.1);border-color:rgba(10,120,70,.3)}
/* ---------- theme change: circular reveal out of the pill ---------- */
html.theme-swap *{transition:none!important}
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
::view-transition-old(root){z-index:1}
::view-transition-new(root){z-index:2}
.musbtn{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.musbtn.is-press{transform:scale(.9)!important;background:rgba(255,255,255,.16)!important;transition:transform .12s,background .12s}
@media (prefers-reduced-motion:reduce){.tpop__eq i{animation:none}}
"""

TRACK_MARKUP = """<div class="scrim" id="scrim" hidden></div>
  <div class="pop island tpop" id="trackPop" role="dialog" aria-label="Soundtrack" hidden>
    <p class="tpop__h">soundtrack</p>
    <button class="titem is-on" type="button" data-track="legacy" aria-pressed="true">
      <span class="tpop__eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="titem__w"><span class="titem__n">Legacy</span><span class="titem__m">2:31 &middot; your track</span></span>
    </button>
    <p class="tpop__f">long-press the pill &middot; tap to play</p>
  </div>
"""


with open('src/music.js', encoding='utf-8') as fh:
    MUSIC_JS = fh.read()
for _k, _f in (('__LEGACY_B64__', 'src/legacy.mp3'),):
    MUSIC_JS = MUSIC_JS.replace(_k, base64.b64encode(open(_f, 'rb').read()).decode('ascii'))
if '__LEGACY_B64__' in MUSIC_JS or '__URBAN_B64__' in MUSIC_JS:
    raise SystemExit('audio placeholders not substituted')


def main():
    s = open(SRC, encoding='utf-8').read()
    orig = len(s)
    log = []

    # 1. CSS
    i = s.find('/* ============ NEON NAGAR')
    j = s.find('/* ============ 3D DEPTH LAYER')
    if i == -1 or j == -1 or j < i:
        raise SystemExit('city css markers missing')
    log.append('%-28s -%d bytes' % ('css: city', j - i))
    s = s[:i] + s[j:]

    i = s.find('/* ============ EZS arena')
    j = s.find('</style>', i)
    if i == -1 or j == -1:
        raise SystemExit('ezs css markers missing')
    log.append('%-28s -%d bytes' % ('css: ezs', j - i))
    s = s[:i] + s[j:]

    # new arcade css just before </style>
    j = s.find('</style>')
    s = s[:j] + ARCADE_CSS + s[j:]

    # 2. scripts (do before markup positions shift)
    #    the old arcade block also held the appearance popover — keep that half
    app_a = s.find('/* ---------- appearance (theme + accent) ---------- */')
    app_b = s.find("window.addEventListener('resize', function(){ if(!layer.hidden) size(); });", app_a)
    if app_a == -1 or app_b == -1:
        raise SystemExit('appearance section markers missing')
    appearance = s[app_a:app_b].rstrip()

    # the popover should morph out of the pill instead of popping in
    old_open = ("  function openAppear(open){\n"
                "    if(!appearPop) return;\n"
                "    appearPop.hidden = !open;\n"
                "    appearBtn.setAttribute('aria-expanded', String(!!open));\n"
                "  }")
    new_open = ("  var appearTimer = null;\n"
                "  function setScrim(open){\n"
                "    var sc = document.getElementById('scrim'); if(!sc) return;\n"
                "    if(open){ sc.hidden = false;\n"
                "      requestAnimationFrame(function(){ sc.classList.add('is-open'); }); }\n"
                "    else { sc.classList.remove('is-open');\n"
                "      setTimeout(function(){ if(!sc.classList.contains('is-open')) sc.hidden = true; }, 320); }\n"
                "  }\n"
                "  function openAppear(open){\n"
                "    if(!appearPop) return;\n"
                "    appearBtn.setAttribute('aria-expanded', String(!!open));\n"
                "    if(appearTimer){ clearTimeout(appearTimer); appearTimer = null; }\n"
                "    if(open){\n"
                "      var tp = document.getElementById('trackPop');\n"
                "      if(tp && !tp.hidden && window.__music) window.__music.close();\n"
                "      setScrim(true);\n"
                "      appearPop.hidden = false;\n"
                "      void appearPop.offsetWidth;                 /* force a frame so the transition runs */\n"
                "      appearPop.classList.add('is-open');\n"
                "    } else {\n"
                "      setScrim(false);\n"
                "      appearPop.classList.remove('is-open');\n"
                "      appearTimer = setTimeout(function(){\n"
                "        if(!appearPop.classList.contains('is-open')) appearPop.hidden = true;\n"
                "      }, 300);\n"
                "    }\n"
                "  }")
    # 3b. a real theme-change animation: clip-path circle reveal from the pill
    theme_anchor = "  function applyAppearance(theme, accent, persist, blur){\n"
    if theme_anchor not in appearance:
        raise SystemExit('applyAppearance not found')
    theme_helpers = (
        "  var revealGuard = false;\n"
        "  function prefersReduced(){ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }\n"
        "  function revealTheme(apply){\n"
        "    var r = appearBtn ? appearBtn.getBoundingClientRect()\n"
        "                     : { left: window.innerWidth / 2, top: window.innerHeight - 40, width: 0, height: 0 };\n"
        "    var x = Math.round(r.left + r.width / 2);\n"
        "    var y = Math.round(r.top + r.height / 2);\n"
        "    var rad = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)));\n"
        "    document.documentElement.classList.add('theme-swap');\n"
        "    var done = function(){ document.documentElement.classList.remove('theme-swap'); };\n"
        "    var vt = document.startViewTransition(apply);\n"
        "    vt.ready.then(function(){\n"
        "      document.documentElement.animate(\n"
        "        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },\n"
        "        { duration: 620, easing: 'cubic-bezier(.36,.72,.16,1)', fill: 'both',\n"
        "          pseudoElement: '::view-transition-new(root)' }\n"
        "      ).finished.then(done, done);\n"
        "    }).catch(done);\n"
        "    vt.finished.then(done, done);\n"
        "  }\n")
    appearance = appearance.replace(theme_anchor, theme_helpers + theme_anchor, 1)

    theme_head = ("  function applyAppearance(theme, accent, persist, blur){\n"
                  "    if(THEMES.indexOf(theme) > -1) rootEl.setAttribute('data-theme', theme);")
    theme_new = ("  function applyAppearance(theme, accent, persist, blur){\n"
                 "    var prevTheme = rootEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';\n"
                 "    var nextTheme = THEMES.indexOf(theme) > -1 ? theme : prevTheme;\n"
                 "    if(!revealGuard && nextTheme !== prevTheme && document.startViewTransition && !prefersReduced()){\n"
                 "      revealTheme(function(){\n"
                 "        revealGuard = true;\n"
                 "        applyAppearance(nextTheme, accent, persist, blur);\n"
                 "        revealGuard = false;\n"
                 "      });\n"
                 "      return;\n"
                 "    }\n"
                 "    if(THEMES.indexOf(theme) > -1) rootEl.setAttribute('data-theme', theme);")
    if theme_head not in appearance:
        raise SystemExit('applyAppearance head not found')
    appearance = appearance.replace(theme_head, theme_new, 1)
    outside_old = "if(!appearPop.hidden && !e.target.closest('.appear')) openAppear(false);"
    outside_new = ("if(!appearPop.hidden && !e.target.closest('.appear') && !e.target.closest('#appearPop'))"
                   " openAppear(false);")
    if outside_old not in appearance:
        raise SystemExit('outside-click handler not found')
    appearance = appearance.replace(outside_old, outside_new, 1)
    log.append('%-28s circle reveal' % 'theme animation:')

    if old_open not in appearance:
        raise SystemExit('openAppear not found in the appearance block')
    appearance = appearance.replace(old_open, new_open)
    log.append('%-28s %d bytes kept' % ('script: appearance', len(appearance)))
    appearance_js = ('<script>/* ---------- appearance popover: theme / accent / glass ---------- */\n'
                     '(function(){\n'
                     '  var P = window.__pal, syncPalette = P ? P.sync : function(){};\n'
                     + appearance + '\n})();\n</script>\n')

    for needle, label in [
        ('/* ============ arcade: matrix run + snake (glass) ============ */', 'script: matrix run + snake'),
        ('NEON NAGAR', 'script: city'),
        ('window.__ezs =', 'script: ezs'),
    ]:
        s = cut(s, script_span(s, needle), label, log)

    # 3. markup
    s = cut(s, div_span(s, 'gameLayer'), 'markup: old arcade', log)
    s = cut(s, div_span(s, 'cityLayer'), 'markup: city', log)
    s = cut(s, div_span(s, 'ezsLayer'), 'markup: ezs', log)

    # 4. new arcade layer where the terminal layer ends
    k = s.find('</div>', s.find('id="termLayer"'))
    # place after the termLayer element by parsing it properly
    a, b = div_span(s, 'termLayer')
    s = s[:b] + '\n\n' + OVERLAY + s[b:]

    # 4b. rain perf hook no longer knows about the city layer
    s = s.replace("  var cityLayerEl = document.getElementById('cityLayer');\n", "")
    s = s.replace(" || (cityLayerEl && !cityLayerEl.hidden)", "")

    # 4c. prune CSS rules that only target markup that no longer exists
    st = s.find('<style')
    en = s.find('</style>')
    if st != -1 and en != -1:
        head, css, tail = s[:st + 7], s[st + 7:en], s[en:]
        rest = head + tail
        tokens = set(re.findall(r'[.#]([A-Za-z_][\w-]*)', css))
        live = set(t for t in tokens
                   if re.search(r'(?<![\w-])' + re.escape(t) + r'(?![\w-])', rest))

        def prune(text, top=True):
            out, i, start, depth = [], 0, 0, 0
            while i < len(text):
                c = text[i]
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        out.append(text[start:i + 1])
                        start = i + 1
                i += 1
            out.append(text[start:])
            kept = []
            for rule in out:
                body_open = rule.find('{')
                if body_open == -1:
                    kept.append(rule)
                    continue
                sel = rule[:body_open]
                if sel.lstrip().startswith('@media') or sel.lstrip().startswith('@supports'):
                    inner = rule[body_open + 1:rule.rfind('}')]
                    kept.append(sel + '{' + prune(inner, False) + '}')
                    continue
                toks = re.findall(r'[.#]([A-Za-z_][\w-]*)', sel)
                if toks and not any(t in live for t in toks):
                    continue
                kept.append(rule)
            return ''.join(kept)

        pruned = prune(css)
        log.append('%-28s -%d bytes' % ('css: dead rules', len(css) - len(pruned)))
        s = head + pruned + tail

    # 4d. music toggle button in the navbar (left of TERMINAL)
    anchor = '<button class="termbtn" id="termBtn"'
    if anchor not in s:
        raise SystemExit('terminal button anchor missing')
    s = s.replace(anchor, MUSIC_MARKUP + anchor, 1)
    j = s.find('</style>')
    s = s[:j] + DOCK_CSS + MUSIC_CSS + TRACK_CSS + s[j:]

    # 4d2. the hero line: drop the old paragraph, set the roman display line
    if ROMAN_OLD not in s:
        raise SystemExit('hero paragraph not found')
    s = s.replace(ROMAN_OLD, ROMAN_NEW, 1)
    font_b64 = open('src/roman.woff2.b64', encoding='utf-8').read().strip()
    j = s.find('</style>')
    eyes_b64 = open('src/eyes.woff2.b64', encoding='utf-8').read().strip()
    s = s[:j] + ROMAN_CSS.replace('__FONT__', font_b64).replace('__EYES__', eyes_b64) + s[j:]

    # 4e. floating dock: pull <nav class="links"> out of the header into one pill
    mnav = re.search(r'<nav class="links"[^>]*>.*?</nav>', s, re.S)
    if not mnav:
        raise SystemExit('nav.links not found')
    nav = mnav.group(0)
    s = s[:mnav.start()] + s[mnav.end():]
    s = s.replace('</header>', '</header>\n\n  <div class="dock" id="dock">\n    ' + nav + '\n  </div>', 1)

    # 5. copy fixes
    s = s.replace('<span class="tgl__txt">TESTING</span>', '<span class="tgl__txt">ARCADE</span>')
    s = s.replace('aria-label="Open the testing game"', 'aria-label="Open the arcade"')
    s = s.replace("['games', 'matrix_run.exe \u00b7 snake.exe']", "['games', 'none yet \u2014 rebuilding']")
    s = s.replace('<span class="ok">alive.txt</span>  <span class="dim">queue.md</span>  <span class="dim">matrix_run.exe</span>  <span class="dim">snake.exe</span>',
                  '<span class="ok">alive.txt</span>  <span class="dim">queue.md</span>  <span class="dim">arcade/</span>')

    # 5b. binary rain: no katakana, only 0/1
    a = s.find("var chars = ('\u30a2")
    if a == -1:
        raise SystemExit('rain glyph array not found')
    b = s.find(".split('');", a)
    if b == -1:
        raise SystemExit('rain glyph array end not found')
    b += len(".split('');")
    log.append('%-28s %d -> 8 bytes' % ('rain glyphs: 0/1', b - a))
    s = s[:a] + "var chars = ('01').split('');" + s[b:]

    # 5c. the appearance card is an island too, and the soundtrack menu + scrim join the body
    if '<div class="pop" id="appearPop"' not in s:
        raise SystemExit('appearPop markup not found')
    s = s.replace('<div class="pop" id="appearPop"', '<div class="pop island" id="appearPop"', 1)

    # 5d. the appearance card must not sit inside .dock: .shell is a stacking context
    #     (position:relative; z-index:2), so anything inside it is painted below the
    #     scrim (z-index:69) and the card ended up blurred and unclickable. Move it to <body>.
    ps, pe = div_span(s, 'appearPop')
    pop_html = s[ps:pe]
    s = s[:ps] + s[pe:]


    # 5e. the rain runs at the display's own refresh rate instead of a 15 fps throttle
    rain_old_head = "  var last = 0, running = true;"
    if rain_old_head not in s:
        raise SystemExit('rain header not found')
    s = s.replace(rain_old_head, "  var last = 0, running = true, prevT = 0;", 1)

    rain_old = """    if (t - last < 66) return;      /* ~15fps: cheap + cinematic */
    last = t;

    ctx.fillStyle = PAL.fade;
    ctx.fillRect(0, 0, w, h);
    ctx.font = fs + 'px JBMonoEmbed, ui-monospace, monospace';
"""
    rain_new = """    /* frame-rate independent: runs at the panel's own refresh (120 / 144 Hz panels
       really do get 120 / 144 fps) while moving and fading at the same speed as before */
    if (!prevT) prevT = t;
    var dt = t - prevT;
    if (dt < 3.4) return;                 /* ceiling ~290 fps, no runaway on odd panels */
    prevT = t;
    var step = dt / 66;                   /* 1.0 == one old frame's worth of motion */
    if (step > 4) step = 4;               /* after a stall, never leap */

    ctx.fillStyle = 'rgba(5,6,7,' + (1 - Math.pow(0.84, step)).toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.font = fs + 'px JBMonoEmbed, ui-monospace, monospace';
"""
    if rain_old not in s:
        raise SystemExit('rain throttle block not found')
    s = s.replace(rain_old, rain_new, 1)

    rain_tail_old = """      if (Math.random() > 0.988){"""
    if rain_tail_old not in s:
        raise SystemExit('rain head-char branch not found')
    s = s.replace(rain_tail_old, """      if (Math.random() < 0.012 * step){""", 1)

    rain_drop_old = """      if (y > h && Math.random() > 0.972) drops[i] = 0;
      drops[i] += 1;"""
    if rain_drop_old not in s:
        raise SystemExit('rain drop advance not found')
    s = s.replace(rain_drop_old, """      if (y > h && Math.random() < 0.028 * step) drops[i] = 0;
      drops[i] += step;""", 1)
    log.append('%-28s %d fps -> display' % ('rain:', 15))

    # 6. scripts at the end of the body: appearance first, then the arcade loader
    s = s.replace('</body>', TRACK_MARKUP + pop_html + '\n' + appearance_js + MUSIC_JS + ARCADE_JS + '</body>')

    open(OUT, 'w', encoding='utf-8').write(s)
    print('\n'.join(log))
    print('%-28s %d -> %d bytes' % ('TOTAL', orig, len(s.encode())))
    print('leftover markers:', [w for w in ('NEON NAGAR', '__ezs', 'cityLayer', 'ezsLayer', 'matrix run', 'snake.exe', 'pickcard') if w in s])


if __name__ == '__main__':
    main()
