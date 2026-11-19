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
             '<span class="rome__dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>')

DOCK_CSS = r'''
/* ---------- floating iOS dock: every nav icon lives in one pill ---------- */
.dock{position:fixed;left:50%;bottom:calc(21px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:70;
  padding:8px;border-radius:999px;display:flex;align-items:center;
  background:rgba(10,18,14,.44);border:1px solid rgba(150,255,200,.16);
  backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);
  box-shadow:0 22px 60px -26px rgba(0,0,0,.95),inset 0 1px 0 rgba(255,255,255,.14)}
.dock .links{margin:0;display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
.dock .lnk,.dock .iconbtn,.dock .termbtn,.dock .tgl{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);
  box-shadow:none;border-radius:999px;height:46px;color:rgba(226,244,232,.86)}
.dock .iconbtn,.dock .lnk,.dock .termbtn{width:46px;padding:0}
.dock .lnk,.dock .termbtn{justify-content:center;font-size:0}
.dock .lnk svg,.dock .termbtn svg{width:20px;height:20px}
.dock .tgl{height:46px;padding:0 14px 0 15px;gap:9px;font-size:11px}
.dock .lnk:hover,.dock .iconbtn:hover,.dock .termbtn:hover,.dock .tgl:hover{background:rgba(255,255,255,.13);color:#eafff2;transform:translateY(-2px)}
.dock .iconbtn:active,.dock .lnk:active,.dock .termbtn:active,.dock .tgl:active{transform:scale(.94)}
.dock .pop{position:fixed;top:auto;bottom:calc(105px + env(safe-area-inset-bottom,0px));left:50%;right:auto;
  z-index:90;animation:none;
  /* dynamic-island morph: the card is pulled out of the pill, then settles */
  transform-origin:50% calc(100% + 52px);
  border-radius:999px;
  transform:translateX(-50%) translateY(6px) scale(.32,.18);
  opacity:0;filter:blur(6px);
  transition:transform .42s cubic-bezier(.18,1.42,.36,1), opacity .22s ease-out, border-radius .42s cubic-bezier(.18,1.42,.36,1), filter .28s ease-out}
.dock .pop.is-open{transform:translateX(-50%) translateY(0) scale(1);opacity:1;filter:blur(0);border-radius:18px}
@media (prefers-reduced-motion:reduce){
  .dock .pop{transition:opacity .15s linear;transform:translateX(-50%);border-radius:18px;filter:none}
  .dock .pop.is-open{transform:translateX(-50%)}
}
.shell{padding-bottom:126px}
html[data-theme="light"] .dock{background:rgba(255,255,255,.6);border-color:rgba(10,21,16,.1);
  box-shadow:0 22px 60px -30px rgba(10,21,16,.5),inset 0 1px 0 #fff}
html[data-theme="light"] .dock .lnk,html[data-theme="light"] .dock .iconbtn,html[data-theme="light"] .dock .termbtn,html[data-theme="light"] .dock .tgl{
  background:rgba(255,255,255,.72);border-color:rgba(10,21,16,.1);color:rgba(16,38,26,.8)}
@media (max-width:560px){
  .dock{padding:7px;bottom:calc(17px + env(safe-area-inset-bottom,0px))}
  .dock .links{gap:5px}
  .dock .iconbtn,.dock .lnk,.dock .termbtn{width:42px;height:42px}
  .dock .tgl{height:42px;padding:0 12px;font-size:10.5px}
  .dock .pop{bottom:calc(91px + env(safe-area-inset-bottom,0px))}
  .shell{padding-bottom:116px}
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
.island{position:fixed;top:auto;bottom:calc(105px + env(safe-area-inset-bottom,0px));left:50%;right:auto;z-index:90;
  animation:none;border-radius:18px;transform-origin:50% calc(100% + 52px);
  transform:translateX(-50%) translateY(10px) scale(.94);
  opacity:0;filter:blur(3px);
  will-change:transform,opacity;
  transition:transform .32s cubic-bezier(.22,.68,.2,1),opacity .16s ease-out,filter .2s ease-out}
.island.is-open{transform:translateX(-50%) translateY(0) scale(1);opacity:1;filter:blur(0)}
@media (max-width:560px){.island{bottom:calc(91px + env(safe-area-inset-bottom,0px))}}
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
    <button class="titem is-on" type="button" data-track="nostalgia" aria-pressed="true">
      <span class="tpop__eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="titem__w"><span class="titem__n">Nostalgia</span><span class="titem__m">2:00 &middot; default</span></span>
    </button>
    <button class="titem" type="button" data-track="og" aria-pressed="false">
      <span class="tpop__eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="titem__w"><span class="titem__n">OG</span><span class="titem__m">1:22 &middot; your track</span></span>
    </button>
    <button class="titem" type="button" data-track="legacy" aria-pressed="false">
      <span class="tpop__eq" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="titem__w"><span class="titem__n">Legacy</span><span class="titem__m">2:31 &middot; your track</span></span>
    </button>
    <p class="tpop__f">long-press the pill &middot; tap to play</p>
  </div>
"""


with open('src/chat.js', encoding='utf-8') as fh:
    CHAT_JS = fh.read()
with open('src/chat.css', encoding='utf-8') as fh:
    CHAT_CSS = fh.read()

with open('src/music.js', encoding='utf-8') as fh:
    MUSIC_JS = fh.read()
for _k, _f in (('__LEGACY_B64__', 'src/legacy.mp3'),
               ('__NOSTALGIA_B64__', 'src/nostalgia.mp3'),
               ('__OG_B64__', 'src/og.mp3')):
    MUSIC_JS = MUSIC_JS.replace(_k, base64.b64encode(open(_f, 'rb').read()).decode('ascii'))
for _k in ('__LEGACY_B64__', '__NOSTALGIA_B64__', '__OG_B64__', '__URBAN_B64__'):
    if _k in MUSIC_JS:
        raise SystemExit('audio placeholder not substituted: ' + _k)


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


    # 5e3. the footer keeps 2026 Evorez + uptime on the bottom line
    FOOT_CSS = """
/* ---------- bottom line ---------- */
.foot{padding-bottom:clamp(11px,1.6vw,16px)!important;font-size:11.5px;gap:8px 18px}
.foot__name{color:var(--ink-2);font-weight:500;letter-spacing:.08em}
#clock{letter-spacing:.1em}
@media (max-width:560px){.foot{font-size:11px;gap:6px 14px;padding-bottom:12px!important}}
"""
    old_foot = '<span>\u00a9 <span id="yr">2026</span> Evorez</span>'
    if old_foot not in s:
        raise SystemExit("footer markup not found")
    s = s.replace(old_foot, '<span class="foot__name"><span id="yr">2026</span> Evorez</span>', 1)
    fj = s.find("</style>")
    s = s[:fj] + FOOT_CSS + s[fj:]

    # 5e5. profile header: big avatar, name, handle, GitHub + Telegram
    hij = s.find('<header class="top">')
    hie = s.find('</header>', hij)
    if hij == -1 or hie == -1:
        raise SystemExit('header not found')
    hie += len('</header>')
    av = re.search(r'<img src="data:image/jpeg;base64,[^"]+"[^>]*>', s[hij:hie])
    if not av:
        raise SystemExit('avatar img not found')
    avatar_img = av.group(0)
    WING = ('<svg class="wing" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.6 3.4c-6.5.2-11.2 3.5-13.8 9'
            '-1 2.1-1.5 4.1-1.6 5.7-.1.8.9 1.3 1.5.7 1.5-1.6 3-3 4.7-4.2 2.9-2.1 5.5-3.6 7.3-4.6.7-.4 1.4.5.8 1'
            '-1.4 1.2-3.3 2.6-5.1 3.9 3.9-.6 6.6-2.6 7.9-6.1.6-1.7.9-3.4.9-4.6 0-.5-.3-.8-.7-.8Z" fill="currentColor"/></svg>')
    GH_ICON = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>')
    TG_ICON = ('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.94 4.3 18.6 20.1c-.25 1.12-.92 1.4-1.86.87l-5.14-3.79-2.48 2.4c-.28.28-.51.51-1.04.51l.37-5.27 9.57-8.65c.42-.37-.09-.58-.64-.21L5.5 13.1.42 11.5c-1.1-.34-1.13-1.1.23-1.63L20.5 2.3c.92-.34 1.72.21 1.44 2z"/></svg>')
    PROFILE = ('<header class="top">\n'
               '    <div class="profile">\n'
               '      <span class="avatar avatar--lg">' + avatar_img + '</span>\n'
               '      <div class="profile__id">\n'
               '        <span class="profile__name">Evorez' + WING + '</span>\n'
               '      </div>\n'
               '    </div>\n'
               '    <div class="profile__acts">\n'
               '      <a class="pact" href="https://github.com/Evorez" target="_blank" rel="noopener noreferrer">' + GH_ICON + '<span>GitHub</span></a>\n'
               '      <a class="pact" href="https://t.me/Evorez" target="_blank" rel="noopener noreferrer">' + TG_ICON + '<span>Telegram</span></a>\n'
               '    </div>\n'
               '  </header>')
    s = s[:hij] + PROFILE + s[hie:]

    PROFILE_CSS = """
/* ---------- profile header ---------- */
.top{flex-direction:column;align-items:stretch;gap:16px}
.profile{display:flex;align-items:center;gap:16px;min-width:0}
.avatar--lg{width:88px;height:88px;padding:3px}
.avatar--lg::after{width:14px;height:14px;right:3px;bottom:3px;border-width:3px}
.profile__id{min-width:0}
.profile__name{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-weight:600;font-style:italic;
  font-size:clamp(26px,5.2vw,38px);line-height:1.05;letter-spacing:.02em;color:#f2fff8;
  text-shadow:0 0 22px rgba(var(--green-rgb),.5),0 0 44px rgba(var(--green-rgb),.22)}
.profile__name .wing{width:22px;height:22px}
.profile__sub{display:block;margin-top:7px;font-size:12.5px;letter-spacing:.02em;color:var(--muted);overflow-wrap:anywhere}
.profile__acts{display:flex;gap:10px}
.pact{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:9px;height:52px;border-radius:999px;
  font-family:var(--mono);font-size:12.5px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;
  color:rgba(232,252,240,.9);border:1px solid rgba(150,255,200,.2);
  background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.02));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 16px 44px -30px rgba(var(--green-rgb),.95);
  transition:transform .22s cubic-bezier(.22,.68,.2,1),background .2s,border-color .2s,color .2s,box-shadow .2s}
.pact svg{width:17px;height:17px;flex:none}
.pact:hover{transform:translateY(-2px);color:#eafff2;border-color:rgba(var(--green-rgb),.5);
  background:linear-gradient(180deg,rgba(var(--green-rgb),.16),rgba(var(--green-rgb),.05));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 18px 44px -26px rgba(var(--green-rgb),1)}
.pact:active{transform:scale(.985)}
html[data-theme="light"] .pact{background:rgba(255,255,255,.72);border-color:rgba(10,21,16,.12);color:rgba(16,38,26,.82)}
html[data-theme="light"] .profile__name{color:#0f2a1c;text-shadow:0 0 20px rgba(var(--green-rgb),.25)}
html[data-theme="light"] .profile__sub,html[data-theme="light"] .foot{color:#47604f}
html[data-theme="light"] .avatar--lg{box-shadow:0 0 0 1px rgba(var(--green-rgb),.28),0 0 26px rgba(var(--green-rgb),.2),0 14px 34px -20px rgba(10,21,16,.5)}
@media (max-width:560px){
  .profile{gap:13px}
  .avatar--lg{width:72px;height:72px}
  .profile__sub{font-size:11.5px}
  .pact{height:48px;font-size:11.5px;letter-spacing:.1em}
}
"""
    pj = s.find('</style>')
    s = s[:pj] + PROFILE_CSS + s[pj:]

    # 5e6. mail button in the pill (gmail icon, evorez.alive@gmail.com)
    mail_anchor = re.search(r'<a class="lnk" href="https://github\.com/Evorez".*?</a>', s, re.S)
    if not mail_anchor:
        raise SystemExit('github pill link not found')
    MAIL_ICON = ('<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.6" y="4.6" width="18.8" '
                 'height="14.8" rx="3.2" stroke="currentColor" stroke-width="1.7"/>'
                 '<path d="m4 7 7.1 5.2a1.6 1.6 0 0 0 1.9 0L20 7" stroke="currentColor" stroke-width="1.7" '
                 'stroke-linecap="round" stroke-linejoin="round"/></svg>')
    MAIL_LINK = ('\n      <a class="lnk" href="mailto:evorez.alive@gmail.com" aria-label="Email evorez.alive@gmail.com">'
                 + MAIL_ICON + '<span>Gmail</span></a>')
    s = s[:mail_anchor.end()] + MAIL_LINK + s[mail_anchor.end():]

    # 5g. pill: drop the duplicate GitHub / Telegram buttons, real theme icon,
    #     frosted header buttons, readable theme-aware matrix rain
    dock_i = s.find('<div class="dock" id="dock">')
    if dock_i < 0:
        raise SystemExit('dock not found')
    dock_j = s.find('</nav>', dock_i)
    dock = s[dock_i:dock_j]
    for pat, tag in ((r'<a class="lnk" href="https://t\.me/Evorez".*?</a>', 'telegram lnk'),
                     (r'<a class="lnk" href="https://github\.com/Evorez".*?</a>', 'github lnk')):
        m = re.search(pat, dock, re.S)
        if not m:
            raise SystemExit('dock link not found: ' + tag)
        dock = dock.replace(m.group(0), '')
    s = s[:dock_i] + dock + s[dock_j:]

    # theme icon: a real moon / sun that follows the current theme
    old_btn = '<button class="iconbtn" id="appearBtn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="appearPop" aria-label="Appearance: theme and accent colour" title="Appearance">\u25d0</button>'
    MOON = ('<svg class="ic-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
            '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.7 8.7 0 1 0 10.8 10.8Z" '
            'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>')
    SUN = ('<svg class="ic-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
           '<circle cx="12" cy="12" r="4.1" stroke="currentColor" stroke-width="1.7"/>'
           '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6'
           'M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" stroke="currentColor" stroke-width="1.7" '
           'stroke-linecap="round"/></svg>')
    new_btn = ('<button class="iconbtn" id="appearBtn" type="button" aria-haspopup="dialog" '
               'aria-expanded="false" aria-controls="appearPop" '
               'aria-label="Appearance: theme and accent colour" title="Appearance">'
               + MOON + SUN + '</button>')
    if old_btn not in s:
        raise SystemExit('appear button markup not found')
    s = s.replace(old_btn, new_btn, 1)

    PILL_CSS = """
/* ---------- pill fixes: real theme icon, 5 buttons ---------- */
#appearBtn{font-size:0;line-height:0}
#appearBtn svg{width:21px;height:21px;display:block}
#appearBtn .ic-sun{display:none}
html[data-theme="light"] #appearBtn .ic-moon{display:none}
html[data-theme="light"] #appearBtn .ic-sun{display:block}
@media (max-width:560px){
  #appearBtn svg{width:19px;height:19px}
}
/* the header buttons read as frosted glass over the rain */
.pact{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.012));
  backdrop-filter:blur(22px) saturate(165%);-webkit-backdrop-filter:blur(22px) saturate(165%);
  border-color:rgba(150,255,200,.16);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 18px 50px -34px rgba(var(--green-rgb),.9)}
.pact:hover{backdrop-filter:blur(26px) saturate(185%);-webkit-backdrop-filter:blur(26px) saturate(185%)}
html[data-theme="light"] .pact{background:rgba(255,255,255,.5);border-color:rgba(10,21,16,.1)}
/* the rain sits under every layer; the hero card must stay flat or Chromium drops
   its backdrop blur and the columns show through the glass as sharp glyphs */
#rain{z-index:-1;opacity:.62}
html[data-theme="light"] #rain{opacity:.28}
/* DEEP glass in light mode was so thin the columns read through the copy */
html[data-theme="light"][data-blur="deep"] .card{background:linear-gradient(180deg,rgba(255,255,255,.86),rgba(248,251,248,.8))}
.card{transform-style:flat;background:linear-gradient(180deg,rgba(8,14,11,.9),rgba(5,8,7,.93))}
"""
    pj = s.rfind('</style>')
    s = s[:pj] + PILL_CSS + s[pj:]

    # ---- matrix rain: rewrite the renderer ----
    rs = s.find('  /* matrix rain */')
    if rs < 0:
        raise SystemExit('rain block start not found')
    re_end = s.find('  requestAnimationFrame(frame);\n})();', rs)
    if re_end < 0:
        raise SystemExit('rain block end not found')
    re_end += len('  requestAnimationFrame(frame);\n})();')
    RAIN = """  /* matrix rain: 0 / 1 only, bold heads, theme aware (never a grey box in light) */
  var c = document.getElementById('rain');
  if(!c || reduce) return;
  var ctx = c.getContext('2d', {alpha:true});
  var GLYPH = ['0', '1'];
  var BG_DARK = '#050607', BG_LIGHT = '#eef1ec';
  var fs = 16, colW = 15, w = 0, h = 0, cols = 0, rows = 0, dpr = 1;
  var y = [], sp = [], ph = [], light = false, seededLight = null;

  function themeIsLight(){
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function seed(i, first){
    y[i] = first ? -Math.random() * rows * 1.25 : -Math.random() * 7 - 1;
    sp[i] = 7 + Math.random() * 13;            /* cells per second */
    ph[i] = Math.random();
  }

  function size(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.clientWidth || window.innerWidth;
    h = c.clientHeight || window.innerHeight;
    c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'top';
    cols = Math.max(1, Math.ceil(w / colW));
    rows = Math.ceil(h / fs) + 2;
    y = new Array(cols); sp = new Array(cols); ph = new Array(cols);
    for (var i = 0; i < cols; i++) seed(i, true);
    light = themeIsLight(); seededLight = light;
    ctx.fillStyle = light ? BG_LIGHT : BG_DARK;
    ctx.fillRect(0, 0, w, h);
  }
  size();
  window.addEventListener('resize', size, {passive:true});

  var prevT = 0, running = true;
  document.addEventListener('visibilitychange', function(){ running = !document.hidden; prevT = 0; });

  /* perf: behind the arcade / chat the rain sits under a heavy blur anyway */
  var gameLayerEl = document.getElementById('gameLayer');
  var termLayerEl = document.getElementById('termLayer');
  function modalOpen(){
    return !!((gameLayerEl && !gameLayerEl.hidden) || (termLayerEl && !termLayerEl.hidden));
  }

  function frame(t){
    requestAnimationFrame(frame);
    if(!running || document.hidden) return;
    if(modalOpen()) return;
    if(!prevT) prevT = t;
    var dt = t - prevT;
    if(dt < 3.4) return;                       /* runs at the panel's own refresh */
    prevT = t;
    var k = Math.min(dt / 1000, 0.25);         /* real seconds since the last frame */

    light = themeIsLight();
    if(light !== seededLight){                 /* theme flipped: repaint the plate */
      ctx.fillStyle = light ? BG_LIGHT : BG_DARK;
      ctx.fillRect(0, 0, w, h);
      seededLight = light;
    }

    var fadeA = 1 - Math.pow(0.12, k);         /* ~3% per 60 Hz frame: long tails */
    ctx.fillStyle = light
      ? 'rgba(238,241,236,' + fadeA.toFixed(3) + ')'
      : 'rgba(5,6,7,' + fadeA.toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);

    ctx.font = '600 ' + fs + 'px JBMonoEmbed, ui-monospace, monospace';
    for(var i = 0; i < cols; i++){
      var cell = Math.floor(y[i]);
      if(cell >= 0 && cell < rows){
        var x = i * colW + 2, py = cell * fs;
        ctx.fillStyle = light ? 'rgba(6,90,50,.9)' : 'rgba(212,255,229,.95)';
        ctx.shadowColor = light ? 'rgba(6,120,66,.55)' : 'rgba(64,255,150,.9)';
        ctx.shadowBlur = light ? 6 : 11;
        ctx.fillText(GLYPH[ph[i] > 0.5 ? 1 : 0], x, py);
        ctx.shadowBlur = 0;
        if(cell > 0){                          /* the cell above keeps the green body tone */
          ctx.fillStyle = light ? 'rgba(14,124,70,.45)' : 'rgba(78,232,148,.6)';
          ctx.fillText(GLYPH[(Math.random() * 2) | 0], x, (cell - 1) * fs);
        }
      }
      y[i] += sp[i] * k;
      if(y[i] - 1 > rows + Math.random() * 10) seed(i, false);
    }
  }
  requestAnimationFrame(frame);
})();"""
    s = s[:rs] + RAIN + s[re_end:]
    log.append('%-28s %s' % ('rain: rewritten', 'theme aware'))
    log.append('%-28s %s' % ('pill:', 'github/telegram out, theme icon in'))

    # 5h. the eyes emoji leaves the hero line
    log.append('%-28s %s' % ('hero:', 'eyes emoji dropped'))

    # 5i. the wordmark reads EVOREZ, upright mono (like the maths-monospace glyphs)
    if 'Evorez' not in s:
        raise SystemExit('wordmark not found')
    s = s.replace('<span class="profile__name">Evorez',
                  '<span class="profile__name">EVOREZ', 1)

    WORD_CSS = """
/* ---------- wordmark: EVOREZ in upright mono ---------- */
.profile__name{font-style:normal;font-weight:600;letter-spacing:.055em;font-size:clamp(23px,4.6vw,33px)}
@media (max-width:560px){.profile__name{letter-spacing:.045em;font-size:clamp(21px,6.4vw,27px)}}
"""
    pj2 = s.rfind('</style>')
    s = s[:pj2] + WORD_CSS + s[pj2:]

    # 5j. copyright, canonical, and a copy guard for unofficial hosts
    TAG = '%Y-%m-%d'
    import hashlib as _hl
    import datetime as _dt
    _fp = _hl.sha256((_dt.datetime.utcnow().strftime(TAG) + str(len(s))).encode()).hexdigest()[:12]
    META = (
        '<!--\n'
        '  Evorez \u2014 https://evorez.vercel.app\n'
        '  Copyright (c) 2026 Evorez. All rights reserved. This file, its design, its copy,\n'
        '  the avatar, the fonts and the audio are the author\'s work. Copying, republishing\n'
        '  or rehosting it whole, or rebuilding it as your own, is not permitted.\n'
        '  Build ' + _dt.datetime.utcnow().strftime(TAG) + ' \u00b7 ' + _fp + '\n'
        '-->\n'
        '<meta name="author" content="Evorez">\n'
        '<meta name="copyright" content="\u00a9 2026 Evorez \u2014 all rights reserved">\n'
        '<meta name="robots" content="index,follow">\n'
        '<link rel="canonical" href="https://evorez.vercel.app/">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:title" content="Evorez \u2014 this page exists because I\'m alive">\n'
        '<meta property="og:url" content="https://evorez.vercel.app/">\n'
        '<meta property="og:site_name" content="Evorez">\n')
    if '<link rel="canonical"' in s:
        raise SystemExit('canonical already present')
    s = s.replace('</head>', META + '</head>', 1)

    GUARD = """<script>
/* copy guard: the page is meant to live at evorez.vercel.app only. An unlisted host
   still renders (so previews and the saved file keep working) but gets a badge and a
   console warning, which is enough to prove a lifted copy in a takedown request. */
(function(){
  var OK = ['evorez.vercel.app', 'localhost', '127.0.0.1', '[::1]'];
  var h = location.hostname || '';
  if (location.protocol === 'file:' || !h || OK.indexOf(h) > -1) return;
  if (/(^|\\.)(e2b\\.app|arena\\.ai|vercel\\.app)$/.test(h)) return;
  function badge(){
    if (document.getElementById('copynote')) return;
    var a = document.createElement('a');
    a.id = 'copynote';
    a.href = 'https://evorez.vercel.app/';
    a.textContent = 'unofficial copy \\u00b7 evorez.vercel.app';
    a.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999;' +
      'font:600 10.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em;' +
      'text-transform:uppercase;text-decoration:none;color:#ffe9e9;' +
      'background:rgba(26,8,10,.86);border:1px solid rgba(255,96,96,.55);' +
      'padding:7px 12px;border-radius:999px;backdrop-filter:blur(8px)';
    document.body.appendChild(a);
  }
  if (document.body) badge(); else document.addEventListener('DOMContentLoaded', badge);
  try{ console.warn('%cThis page is an unauthorised copy of Evorez \\u2014 https://evorez.vercel.app',
    'color:#ff7b7b;font-weight:700'); }catch(e){}
})();
</script>
"""
    s = s.replace('</body>', GUARD + '</body>', 1)
    log.append('%-28s %s' % ('copy guard:', 'canonical + badge on foreign hosts'))

    # 5f. the terminal becomes the chat: drop py-lite + the terminal script, swap the panel
    py_a = s.find('/* ---------- py-lite')
    if py_a == -1:
        raise SystemExit('py-lite script not found')
    py_a = s.rfind('<script>', 0, py_a)
    term_a = s.find('/* ============ terminal (shell + python repl)')
    if term_a == -1:
        raise SystemExit('terminal script not found')
    term_b = s.find('</script>', term_a)
    if term_b == -1:
        raise SystemExit('terminal script end not found')
    term_b += len('</script>')
    cut_len = term_b - py_a
    s = s[:py_a] + s[term_b:]
    log.append('%-28s -%d bytes' % ('removed: terminal + py-lite', cut_len))

    ts, te = div_span(s, 'termLayer')
    CHAT_MARKUP = """<div class="term" id="termLayer" hidden>
  <div class="term__box" role="dialog" aria-modal="true" aria-labelledby="chatName">
    <div class="term__bar">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span id="chatName"><b>Evorez</b> &middot; ask me anything</span>
      <span class="chat__live" id="chatLive" data-state="online"><i></i>online</span>
      <button class="term__x" id="chatClose" type="button" aria-label="Close chat">&times;</button>
    </div>
    <div class="term__body chat__log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div>
    <div class="chat__starters" id="chatStarters"></div>
    <form class="term__prompt" id="chatForm" autocomplete="off">
      <span class="term__ps" aria-hidden="true">&gt;</span>
      <input class="term__in" id="chatIn" name="msg" type="text" autocomplete="off" autocapitalize="sentences"
             enterkeyhint="send" maxlength="400" aria-label="Message Evorez"
             placeholder="ask me anything — who I am, what I am building, hiring?" />
      <button class="chat__send" id="chatSend" type="submit" aria-label="Send message">&uarr;</button>
    </form>
    <p class="term__hint"><span>free model</span><span>instant answers</span><span>can be wrong</span><span>esc close</span></p>
  </div>
</div>"""
    s = s[:ts] + CHAT_MARKUP + s[te:]
    s = s.replace('aria-label="Open the terminal"', 'aria-label="Chat with Evorez"', 1)
    s = s.replace('<span>TERMINAL</span>', '<span>CHAT</span>', 1)
    j = s.find('</style>')
    s = s[:j] + CHAT_CSS + s[j:]
    log.append('%-28s chat panel + css' % 'terminal -> chat:')

    # 6. scripts at the end of the body: appearance first, then the arcade loader
    s = s.replace('</body>', TRACK_MARKUP + pop_html + '\n' + appearance_js + MUSIC_JS + ARCADE_JS + CHAT_JS + '</body>')

    open(OUT, 'w', encoding='utf-8').write(s)
    print('\n'.join(log))
    print('%-28s %d -> %d bytes' % ('TOTAL', orig, len(s.encode())))
    print('leftover markers:', [w for w in ('NEON NAGAR', '__ezs', 'cityLayer', 'ezsLayer', 'matrix run', 'snake.exe', 'pickcard') if w in s])


if __name__ == '__main__':
    main()
