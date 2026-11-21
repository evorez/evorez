<script>/* ---------- chat: instant local FAQs and streamed replies from our backend ---------- */
(function(){
  var layer   = document.getElementById('termLayer'),
      btn     = document.getElementById('termBtn'),
      logEl   = document.getElementById('chatLog'),
      form    = document.getElementById('chatForm'),
      input   = document.getElementById('chatIn'),
      sendBt  = document.getElementById('chatSend'),
      closeB  = document.getElementById('chatClose'),
      chipBox = document.getElementById('chatStarters'),
      liveEl  = document.getElementById('chatLive');
  if(!layer || !btn || !logEl) return;

  var BOT = {
    backend: 'https://khkkqkpzutqltbzfhfuf.supabase.co/functions/v1/chat',
    timeout: 11500,
    starters: ['who are you?', 'what are you building?', 'how is the music?', 'should I hire you?'],
    greeting: 'Hey. I am Evorez, and this page is the status update. Ask me anything.'
  };
  var busy = false, greeted = false, turns = 0, waitUntil = 0;
  var mobile = window.matchMedia('(pointer: coarse)');
  var viewport = window.visualViewport, preconnect = null;

  /* ---- the local brain: accurate answers for the things people actually ask ---- */
  var FAQ = [
    [/\b(kaun|who are|who r u|who is|intro|naam|name)\b/i,
     'I am Evorez, a solo builder who ships in public. This page is the status update: alive, building.'],
    [/\b(kya bana|kya banaya|what is this|whats this|this site|ye site|project|work on|building|bana raha|banaya hai)\b/i,
     'This site is the project: one HTML file, no framework, fonts and music embedded. Version 2 is in the works.'],
    [/\b(music|song|track|legacy|nostalgia|og|audio|sound|gaana)\b/i,
     'Nostalgia plays by default, 2:00 long. Long-press the music button in the pill to switch to OG (1:22) or Legacy (2:31).'],
    [/\b(hire|job|collab|contact|reach|telegram|mail|email|talk)\b/i,
     'For work or collabs: evorez.alive@gmail.com, or Telegram t.me/Evorez. Code lives at github.com/Evorez.'],
    [/\b(theme|dark|light|accent|glass|colour|color)\b/i,
     'The first button in the pill switches theme, accent colour and glass. Going light plays a circle reveal.'],
    [/\b(stack|tech|code|html|css|framework|how did you build)\b/i,
     'All hand-written HTML, CSS and JS. One file, no framework, no CDN, even the fonts are base64.'],
    [/\b(blog|social|twitter|insta|x\.com)\b/i,
     'Only Telegram and GitHub: t.me/Evorez and github.com/Evorez.'],
    [/\b(ai|bot|llm|model|are you real)\b/i,
     'Yes, a free model sits behind this chat, no paid key. When its quota runs out I answer from local notes.'],
    [/\b(price|cost|charge|free|money)\b/i,
     'This site is free and stays free. For paid work, Telegram: t.me/Evorez.'],
    [/\b(uptime|clock|time|footer|2026)\b/i,
     'The footer is honest about it: uptime, since I woke up. The clock ticks every second and 2026 is chased.'],
    [/\b(v2|version 2|next|future|roadmap|plan)\b/i,
     'Next is version 2: same single file, faster and cleaner. Updates go out on Telegram.'],
    [/\b(hi|hello|hey|yo|namaste|salam)\b/i,
     'Hey. Ask me anything, I am right here.'],
    [/\b(thank|thanks|nice|cool|love it)\b/i,
     'Appreciate it. Building beats talking.']
  ];
  function intentOf(q){
    for(var i = 0; i < FAQ.length; i++) if(FAQ[i][0].test(q)) return { hit: true, reply: FAQ[i][1] };
    return { hit: false, reply: '' };
  }
  /* ---- text hygiene: the model loves markdown, HTML and emoji we cannot render ---- */
  function clean(t){
    return (t || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\[([^\]]{1,60})\]\(\s*(https?:[^)\s]+)\s*\)/g, '$1')
      .replace(/[*_`#>]+/g, '')
      .replace(/^[ \t]*[-•·][ \t]+/gm, '')
      .replace(/[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  var LINK = /(https?:\/\/[^\s<>"')]+|t\.me\/[\w.\/-]+|github\.com\/[\w.\/-]+|evorez\.vercel\.app[\w.\/-]*)/g;
  function paintText(node, text){
    var last = 0, m;
    LINK.lastIndex = 0;
    while((m = LINK.exec(text))){
      if(m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var url = m[0].replace(/[.,;:!?)]+$/, '');
      var a = document.createElement('a');
      a.href = url.indexOf('http') === 0 ? url : 'https://' + url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = url;
      node.appendChild(a);
      var tail = m[0].slice(url.length);
      if(tail) node.appendChild(document.createTextNode(tail));
      last = m.index + m[0].length;
    }
    if(last < text.length) node.appendChild(document.createTextNode(text.slice(last)));
  }

  /* ---- rendering ---- */
  function el(tag, cls, text){
    var n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text != null) n.textContent = text;
    return n;
  }
  function add(who, text){
    var n = el('div', 'msg msg--' + who);
    who === 'bot' ? paintText(n, text) : n.textContent = text;
    logEl.appendChild(n);
    logEl.scrollTop = logEl.scrollHeight;
    return n;
  }
  function pending(){
    var n = el('div', 'msg msg--bot chat__pending', 'Thinking');
    n.setAttribute('aria-hidden', 'true');
    var d = el('span', 'chat__typing');
    for(var i = 0; i < 3; i++) d.appendChild(el('i'));
    n.appendChild(d);
    logEl.appendChild(n);
    logEl.scrollTop = logEl.scrollHeight;
    return n;
  }
  function state(s){
    if(!liveEl) return;
    liveEl.setAttribute('data-state', s);
    liveEl.lastChild && (liveEl.lastChild.nodeValue = s === 'thinking' ? 'thinking' : s === 'wait' ? 'wait' : s === 'off' ? 'offline' : 'online');
  }
  function paintStarters(){
    if(!chipBox) return;
    chipBox.textContent = '';
    BOT.starters.forEach(function(s){
      var b = el('button', 'chat__chip', s);
      b.type = 'button';
      b.addEventListener('click', function(){ send(s); });
      chipBox.appendChild(b);
    });
  }

  function sessionId(){
    var k = 'evorez.chat.sid', v = '';
    try{ v = localStorage.getItem(k) || ''; }catch(e){}
    if(!v){
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      v = Array.from(bytes, function(x){ return x.toString(16).padStart(2, '0'); }).join('');
      try{ localStorage.setItem(k, v); }catch(e){}
    }
    return v;
  }

  /* A simple POST avoids a mobile CORS preflight. Legacy JSON replies still work. */
  async function ask(text, onDelta, signal){
    var response = await fetch(BOT.backend, {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: JSON.stringify({ session_id: sessionId(), message: text }),
      signal: signal
    });
    if(response.status === 429) return { limited: true };
    if(!response.ok) throw new Error('chat unavailable');
    if(!response.body || !(response.headers.get('Content-Type') || '').includes('text/event-stream')){
      return await response.json();
    }
    var reader = response.body.getReader(), decoder = new TextDecoder(), buffer = '';
    try{
      for(;;){
        var next = await reader.read();
        buffer += next.done ? decoder.decode() + '\n' : decoder.decode(next.value, { stream: true });
        var end;
        while((end = buffer.indexOf('\n')) !== -1){
          var line = buffer.slice(0, end).replace(/\r$/, '');
          buffer = buffer.slice(end + 1);
          if(!line.startsWith('data:')) continue;
          var event = JSON.parse(line.slice(5));
          if(event.type === 'delta' && typeof event.text === 'string') onDelta(event.text);
          if(event.type === 'done') return event;
          if(event.type === 'error') throw new Error('chat unavailable');
        }
        if(next.done) break;
      }
      throw new Error('incomplete reply');
    }finally{
      await reader.cancel().catch(function(){});
      reader.releaseLock();
    }
  }

  async function send(raw){
    var text = (raw || '').trim();
    if(!text || busy) return;
    var hit = intentOf(text);
    if(chipBox) chipBox.textContent = '';
    add('me', text);
    input.value = '';
    turns += 2;
    if(hit.hit){ add('bot', hit.reply); return; }
    if(Date.now() < waitUntil){ add('bot', 'This chat has reached its daily limit. Try again tomorrow.'); return; }

    busy = true;
    if(sendBt) sendBt.disabled = true;
    state('thinking');
    var preview = pending(), full = '', reply = '';
    var ctl = new AbortController();
    var timeout = setTimeout(function(){ ctl.abort(); }, BOT.timeout);
    try{
      var out = await ask(text, function(part){
        full += part;
        var chunk = clean(full);
        if(!chunk) return;
        preview.classList.add('chat__pending--stream');
        preview.textContent = chunk;
        logEl.scrollTop = logEl.scrollHeight;
      }, ctl.signal);
      if(out.limited){
        waitUntil = Date.now() + 30000;
        state('wait');
        reply = 'This chat has reached its daily limit. Try again tomorrow.';
      }else{
        if(typeof out.reply !== 'string' || !(reply = clean(out.reply))) throw new Error('empty reply');
        state('online');
      }
    }catch(e){
      state('off');
      reply = ctl.signal.aborted ? 'That reply took too long. Try again.' : 'I couldn’t get a reply right now. Try again in a moment.';
    }finally{
      clearTimeout(timeout);
      preview.remove();
      add('bot', reply);
      busy = false;
      if(sendBt) sendBt.disabled = false;
      if(!layer.hidden && !mobile.matches && document.activeElement === document.body) input.focus({ preventScroll: true });
    }
  }

  function fitChat(){
    if(!viewport || !mobile.matches || layer.hidden) return;
    layer.style.setProperty('--chat-height', Math.floor(viewport.height) + 'px');
    layer.style.setProperty('--chat-top', Math.floor(viewport.offsetTop) + 'px');
  }
  if(viewport){
    viewport.addEventListener('resize', fitChat, { passive: true });
    viewport.addEventListener('scroll', fitChat, { passive: true });
  }

  /* ---- open / close ---- */
  function openChat(){
    layer.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if(!preconnect){
      preconnect = el('link');
      preconnect.rel = 'preconnect';
      preconnect.href = new URL(BOT.backend).origin;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }
    if(!greeted){
      greeted = true;
      add('bot', BOT.greeting);
      paintStarters();
    }
    fitChat();
    (mobile.matches && closeB ? closeB : input).focus({ preventScroll: true });
  }
  function closeChat(){
    layer.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.focus({ preventScroll: true });
  }

  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', function(e){ e.stopPropagation(); layer.hidden ? openChat() : closeChat(); });
  if(closeB) closeB.addEventListener('click', closeChat);
  layer.addEventListener('click', function(e){ if(e.target === layer) closeChat(); });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && !layer.hidden) closeChat();
  });
  form.addEventListener('submit', function(e){ e.preventDefault(); send(input.value); });

  state('online');

  window.__chat = {
    open: openChat, close: closeChat, ask: send,
    state: function(){ return { open: !layer.hidden, messages: turns, busy: busy,
      waitLeft: Math.max(0, Math.round((waitUntil - Date.now()) / 1000)) }; },
    config: BOT
  };
})();</script>
