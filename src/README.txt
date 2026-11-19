Evorez — source notes (current build: 2026-11-19, arcade empty)
================================================================
index.html is the deliverable: one file, no network calls. It now contains NO games.
Removed in this build (markup + <script> + CSS + picker cards):
  * MATRIX RUN and SNAKE.EXE  (was the "arcade: matrix run + snake" script block)
  * NEON NAGAR city           (was #cityLayer + its own ~112 KB script + city CSS)
  * EZS stickman arena        (was #ezsLayer + its script + .ezs__ CSS)
The untouched full build is archived at archive/index-full-games-final.html (388,700 B) and
archive/index-full-games-<date>.html. src/city.js and src/ezs.js are the old game sources — they
are NOT referenced by index.html any more, they are kept only in case a game comes back.

What replaced them
------------------
#gameLayer -> .game__box (glass dialog) -> .arc
  .arc[data-phase="load"]  loading bar (role="progressbar", filled with transform:scaleX(n))
  .arc[data-phase="soon"]  "no games yet" panel + BACK
Script: last <script> block in the file ("arcade: loader -> no games yet").
  hooks: window.__arcade.open() / .close() / .phase()   (phase = "load" | "soon")
CSS: search "arcade: empty for now" (right before </style>).

How index.html is produced
--------------------------
Do NOT hand-edit the stripped file: it is generated.
  python3 build_stripped.py     # reads archive/index-full-games-final.html -> index.stripped.html
  cp index.stripped.html index.html
The build script removes the games, keeps the appearance popover (it used to live inside the arcade
script block), prunes CSS rules whose every class/id no longer exists, and injects the new arcade
layer + loader script. Edit build_stripped.py, not the output.

Music toggle (single track)
---------------------------
src/music.js = the whole music script, injected before </body> by build_stripped.py.
One track, one click. It is synthesised, not sampled: 72 bpm 4/4 in D minor, chords Dm-Bb-Gm-A,
string ostinato (bowed saw + vibrato) over a low drone, sparse lead, soft kick, metallic tick.
The mood is crime-saga title music; the melody and chords are original, nothing from GTA IV
("Soviet Connection" by Michael Hunter) or any other soundtrack is used or copied.
Button = #musicBtn in the dock (.iconbtn.musbtn), CSS "music toggle (procedural" near the end of <style>.
State  = localStorage 'evorez_music' ('1' / '0'); a saved "on" only resumes on the first gesture
         because browsers block unprompted audio.
Hooks  = window.__music.state() -> {on, ctx, gain, step, saved}; window.__music.toggle()
No picker, no long press, no scene switching: there is exactly one TRACK object in the script.
NOTE: Nino Rota's Godfather theme is still in copyright (Paramount) and the YouTube cover was
      neither ours nor licensed, so nothing from it is embedded. If a licensed file ever arrives,
      embed it as an <audio> element (20 s @ 80 kbps ~ 160 KB, ~215 KB as base64) and drop this synth.

Hero line + fonts
-----------------
.rome  = "All Eyes On You" display line in the hero (search 'class="rome"')
         font 'Evorez Roman' = subset of DejaVu Serif (Bitstream Vera licence), only the glyphs needed
         font 'Evorez Eyes'  = single-glyph slice of Noto Color Emoji (SIL OFL 1.1), U+1F440
         both base64 in src/roman.woff2.b64 and src/eyes.woff2.b64, injected by build_stripped.py
Dock popovers
  .dock .pop is position:fixed, horizontally centred on the pill and opening upward
  (bottom: 92px desktop / 80px mobile + safe-area) - keep this rule for any new dock popover.
  The open/close morph lives in openAppear(): adds .is-open after a forced frame, and only sets
  hidden after 300 ms so the reverse transition can play. transform-origin is 50% calc(100% + 54px),
  i.e. the pill itself, so the card reads as growing out of the dock.

Kept and still working
----------------------
appearance popover (theme / accent / glass, persisted in localStorage 'evorez_appearance'),
matrix rain + clock, terminal (py-lite), theme-aware palette, reduced-motion handling.

Deploy
------
  cp index.html dist/index.html && rm -f evorez-site.zip && (cd dist && zip -q -r ../evorez-site.zip .)
  ./deploy.sh        # Vercel CLI, project evorez, team team_p7t5Mz1Y6gpMp41sQyUuKMpc
  rm -rf dist/.vercel dist/.env.local dist/.gitignore

music.js (2026-11 rebuild)
  - two embedded tracks: src/legacy.mp3 (151,272 B) and src/urban.mp3 (76,355 B), base64-injected by
    build_stripped.py at replace time (placeholders __LEGACY_B64__ / __URBAN_B64__).
  - decodeAudioData -> looping AudioBufferSourceNode -> master gain (0 -> 1 over 1.1 s).
  - default: Legacy, on (attempts autoplay; a blocked context is resumed by the first non-pill gesture,
    and a tap on a still-suspended context resumes instead of muting).
  - long press 460 ms on #musicBtn opens #trackPop (island morph + #scrim blur); tapping an item
    switches track with a 0.22 s fade. Hooks: window.__music.state()/pick()/open()/close()/toggle().
