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
    starters: ['who are you?', 'what is EZseed?', 'how is the music?', 'how do I get in touch?'],
    greeting: 'Hey. I am Evorez, and this page is the status update. Ask me anything.'
  };
  var busy = false, greeted = false, turns = 0;
  var PUBLIC_EMAIL = 'coolex.in@gmail.com';
  var BASIC_REPLY = 'I can still help with Evorez, this site, EZseed, the music, or getting in touch. Pick a topic below.';
  var mobile = window.matchMedia('(pointer: coarse)');
  var viewport = window.visualViewport, preconnect = null;

  /* ---- the local brain: accurate answers for the things people actually ask ---- */
  var FAQ = [
    [/\b(kaun|who are|who r u|who is|intro|naam|name)\b/i,
     'I am Evorez, a solo builder who ships in public. This page is the status update: alive, building.'],
    [/\b(ezseed|minecraft seed|seed map)\b/i,
     'EZseed is a Minecraft seed map for Java and Bedrock. Try it at https://evorez.in/ezseed/.'],
    [/\b(kya bana|kya banaya|what is this|whats this|this site|ye site|project|work on|building|bana raha|banaya hai)\b/i,
     'This profile is one HTML file with embedded fonts and music. I also built EZseed, a Minecraft seed map: https://evorez.in/ezseed/.'],
    [/\b(music|song|track|legacy|nostalgia|og|audio|sound|gaana)\b/i,
     'Music starts off. Tap the music button for Nostalgia, or long-press it to choose OG or Legacy.'],
    [/\b(hire|job|collab|contact|reach|get in touch|telegram|mail|email|talk)\b/i,
     'For work or collabs: ' + PUBLIC_EMAIL + ', or Telegram t.me/Evorez. Code lives at github.com/Evorez.'],
    [/\b(theme|dark|light|accent|glass|colour|color)\b/i,
     'The first button in the pill switches theme, accent colour and glass. Going light plays a circle reveal.'],
    [/\b(stack|tech|code|html|css|framework|how did you build)\b/i,
     'All hand-written HTML, CSS and JS. One file, no framework, no CDN, even the fonts are base64.'],
    [/\b(blog|social|twitter|insta|x\.com)\b/i,
     'Only Telegram and GitHub: t.me/Evorez and github.com/Evorez.'],
    [/\b(ai|bot|llm|model|are you real)\b/i,
     'Gemini handles live chat. Quick answers about the profile, music, EZseed and contact details work even without it.'],
    [/\b(price|cost|charge|free|money)\b/i,
     'This site is free and stays free. For paid work, Telegram: t.me/Evorez.'],
    [/\b(uptime|clock|time|footer|2026)\b/i,
     'The footer is honest about it: uptime, since I woke up. The clock ticks every second and 2026 is chased.'],
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
      .replace(/\bevorez\.alive@gmail\.com\b/gi, PUBLIC_EMAIL)
      .replace(/\s*\n\s*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  var LINK = /(https?:\/\/[^\s<>"')]+|coolex\.in@gmail\.com|t\.me\/[\w.\/-]+|github\.com\/[\w.\/-]+|evorez\.vercel\.app[\w.\/-]*)/gi;
  function paintText(node, text){
    var last = 0, m;
    LINK.lastIndex = 0;
    while((m = LINK.exec(text))){
      if(m.index > last) node.appendChild(document.createTextNode(text.slice(last, m.index)));
      var url = m[0].replace(/[.,;:!?)]+$/, '');
      var a = document.createElement('a');
      var mail = url.toLowerCase() === PUBLIC_EMAIL;
      a.href = mail ? 'mailto:' + PUBLIC_EMAIL : /^https?:/i.test(url) ? url : 'https://' + url;
      if(!mail){ a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.textContent = mail ? PUBLIC_EMAIL : url;
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
    liveEl.lastChild && (liveEl.lastChild.nodeValue = s === 'thinking' ? 'thinking' : s === 'basic' ? 'quick answers' : 'online');
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

  function textReply(value){
    if(typeof value !== 'string') return '';
    var text = clean(value);
    return /^(?:the\s+free\s+model\b.*\bquota\b|(?:error:\s*)?(?:too many requests|rate limit (?:exceeded|reached)))/i.test(text) ? '' : text;
  }
  function basicReply(){
    state('basic');
    add('bot', BASIC_REPLY);
    paintStarters();
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
    if(navigator.onLine === false){ basicReply(); return; }

    busy = true;
    if(sendBt) sendBt.disabled = true;
    state('thinking');
    var preview = pending(), full = '', reply = '';
    var ctl = new AbortController();
    var timeout = setTimeout(function(){ ctl.abort(); }, BOT.timeout);
    try{
      var out = await ask(text, function(part){
        full += part;
        var chunk = textReply(full);
        if(!chunk) return;
        preview.classList.add('chat__pending--stream');
        preview.textContent = chunk;
        logEl.scrollTop = logEl.scrollHeight;
      }, ctl.signal);
      if(out && out.model !== 'local') reply = textReply(out.reply);
    }catch(e){ /* A connection error or timeout should never prevent a local answer. */ }
    finally{
      clearTimeout(timeout);
      preview.remove();
      if(reply){ state('online'); add('bot', reply); }
      else basicReply();
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

  state(navigator.onLine === false ? 'basic' : 'online');

  window.__chat = {
    open: openChat, close: closeChat, ask: send,
    state: function(){ return { open: !layer.hidden, messages: turns, busy: busy }; },
    config: BOT
  };
})();</script>
