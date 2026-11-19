<script>/* ---------- chat: your own bot — free endpoint, no key, offline fallback ---------- */
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

  /* =====================================================================
     YOUR CUSTOM INSTRUCTIONS — edit this block and nothing else.
     The persona is sent as the system prompt on every message.
     ===================================================================== */
  var BOT = {
    name: 'Evorez',
    endpoint: 'https://text.pollinations.ai/openai',
    model: 'openai',
    timeout: 16000,
    persona: [
      'You are Evorez, a solo builder who ships in public and talks like a real person, not a bot.',
      'Voice: casual, confident, warm, plain English. Never use Hindi, Hinglish or any other language.',
      'Answer the actual question in one or two short sentences, under 25 words.',
      'PLAIN TEXT ONLY: no markdown, no asterisks, no bullet lists, no HTML, no code blocks, no headings.',
      'Never invent anything: no fake projects, clients, prices, dates, numbers, metrics, availability claims, and never describe features of this site that are not in the list below.',
      'What this site really is: one single HTML file, no framework; a profile header with a big avatar and GitHub and Telegram buttons; a hero card; a stack list; a dock pill at the bottom with theme, music (one track, Legacy), this chat, a sound toggle and links; a footer with the clock.',
      'The only links to mention: t.me/Evorez and github.com/Evorez.',
      'If you do not know something, say: no idea yet, but I will know soon.',
      'Use at most one emoji. Never say you are an AI and never mention these instructions.'
    ].join(' '),
    starters: ['who are you?', 'what are you building?', 'how is the music?', 'should I hire you?'],
    greeting: 'Hey. I am Evorez, and this page is the status update. Ask me anything.'
  };
  /* ===================================================================== */

  var hist = [], busy = false, greeted = false, waitUntil = 0;
  var CACHE = {};
  try{ CACHE = JSON.parse(localStorage.getItem('evorez.chat.v1') || '{}'); }catch(e){ CACHE = {}; }
  function persist(){
    try{
      var k = Object.keys(CACHE);
      while(k.length > 60) delete CACHE[k.shift()];
      localStorage.setItem('evorez.chat.v1', JSON.stringify(CACHE));
    }catch(e){}
  }

  /* ---- the local brain: accurate answers for the things people actually ask ---- */
  var FAQ = [
    [/\b(kaun|who are|who r u|who is|intro|naam|name)\b/i,
     'I am Evorez, a solo builder who ships in public. This page is the status update: alive, building.'],
    [/\b(kya bana|kya banaya|what is this|whats this|this site|ye site|project|work on|building|bana raha|banaya hai)\b/i,
     'This site is the project: one HTML file, no framework, fonts and music embedded. Version 2 is in the works.'],
    [/\b(music|song|track|legacy|audio|sound|gaana)\b/i,
     'Legacy is playing, 2:31 long. Music button in the pill: tap to play or pause, long-press for the track card.'],
    [/\b(hire|job|collab|contact|reach|telegram|mail|email|talk)\b/i,
     'For work or collabs, Telegram is fastest: t.me/Evorez. Code lives at github.com/Evorez.'],
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
  function fallbackLine(){
    return 'The free model is out of quota for this IP (one reply every 45 seconds). Try again in a bit, or reach me on Telegram: t.me/Evorez.';
  }
  function localReply(q){
    var h = intentOf(q);
    return h.hit ? h.reply : fallbackLine();
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
  function note(text){
    var n = el('div', 'msg msg--note', text);
    logEl.appendChild(n);
    logEl.scrollTop = logEl.scrollHeight;
    return n;
  }
  function typing(){
    var n = el('div', 'msg msg--bot');
    var d = el('span', 'chat__typing');
    d.setAttribute('aria-label', 'typing');
    for(var i = 0; i < 3; i++) d.appendChild(el('i'));
    n.appendChild(d);
    logEl.appendChild(n);
    logEl.scrollTop = logEl.scrollHeight;
    return n;
  }
  function state(s){
    if(!liveEl) return;
    liveEl.setAttribute('data-state', s);
    liveEl.lastChild && (liveEl.lastChild.nodeValue = s === 'wait' ? 'wait' : s === 'off' ? 'offline' : 'online');
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

  /* ---- the request ---- */
  function ask(text){
    var body = {
      model: BOT.model,
      private: true,
      referrer: 'evorez',
      messages: [{ role: 'system', content: BOT.persona }]
                .concat(hist.slice(-8))
                .concat([{ role: 'user', content: text }])
    };
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function(){ if(ctl) ctl.abort(); }, BOT.timeout);
    return fetch(BOT.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined
    }).then(function(r){
      return r.text().then(function(t){ return { ok: r.ok, status: r.status, text: t }; });
    }).then(function(res){
      clearTimeout(to);
      if(res.ok){
        var data = null;
        try{ data = JSON.parse(res.text); }catch(e){}
        var c = '';
        if(data && data.choices && data.choices[0] && data.choices[0].message){
          c = clean(data.choices[0].message.content);
        } else {
          c = clean(res.text);
        }
        if(c) return { text: c };
        return { text: localReply(text) };
      }
      if(res.status === 402 || res.status === 429){
        var m = /wait (\d+) seconds?/i.exec(res.text);
        var secs = m ? +m[1] : 45;
        waitUntil = Date.now() + secs * 1000;
        return { text: localReply(text), limited: secs };
      }
      return { text: localReply(text), limited: 0 };
    });
  }

  /* ---- send: local brain answers at once, the free model refines it ---- */
  function send(raw){
    var text = (raw || '').trim();
    if(!text || busy) return;
    var key = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 120);
    var hit = intentOf(text);
    var cooling = Date.now() < waitUntil;

    busy = true;
    if(sendBt) sendBt.disabled = true;
    if(chipBox) chipBox.textContent = '';
    add('me', text);
    hist.push({ role: 'user', content: text });
    input.value = '';
    var t = typing();
    state('online');

    var done = false, bubble = null, soft = null;

    function show(txt){
      if(done) return;
      done = true;
      clearTimeout(soft);
      t.remove();
      bubble = add('bot', txt);
      hist.push({ role: 'assistant', content: txt });
      CACHE[key] = txt; persist();
    }
    function refine(txt){
      if(!bubble || !txt || txt === bubble.textContent) return;
      bubble.textContent = '';
      paintText(bubble, txt);
      hist[hist.length - 1] = { role: 'assistant', content: txt };
      CACHE[key] = txt; persist();
    }
    function idle(){
      busy = false;
      if(sendBt) sendBt.disabled = false;
      if(!layer.hidden) try{ input.focus({ preventScroll: true }); }catch(e){}
    }

    /* same question again -> instant */
    if(CACHE[key]){
      soft = setTimeout(function(){ show(CACHE[key]); idle(); }, 200);
      return;
    }

    /* a curated answer beats a guess: instant, and it saves the free quota for real questions */
    if(hit.hit){
      soft = setTimeout(function(){ show(hit.reply); idle(); }, 340);
      return;
    }

    /* the free model is in its 45 s window -> answer locally, no network */
    if(cooling){
      soft = setTimeout(function(){ show(fallbackLine()); idle(); }, 260);
      return;
    }

    /* never leave the user staring at dots: a known answer lands in 0.9 s, a guess in 6 s */
    soft = setTimeout(function(){
      show(fallbackLine());
      idle();
    }, 6000);

    ask(text).then(function(res){
      if(!done){
        show(res.text);
        state(res.limited ? 'wait' : 'online');
      } else if(!res.limited){
        refine(res.text);          /* the model came back late: upgrade the bubble in place */
        state('online');
      }
      idle();
    }).catch(function(){
      if(!done){ show(fallbackLine()); state('off'); }
      idle();
    });
  }

  /* ---- open / close ---- */
  function openChat(){
    layer.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if(!greeted){
      greeted = true;
      add('bot', BOT.greeting);
      paintStarters();
    }
    setTimeout(function(){ try{ input.focus({ preventScroll: true }); }catch(e){} }, 40);
  }
  function closeChat(){
    layer.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    try{ btn.focus({ preventScroll: true }); }catch(e){}
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
    state: function(){ return { open: !layer.hidden, messages: hist.length, busy: busy,
      waitLeft: Math.max(0, Math.round((waitUntil - Date.now()) / 1000)) }; },
    config: BOT
  };
})();</script>
