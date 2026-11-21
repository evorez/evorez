// Evorez chat. JSON for old clients; SSE for the live chat panel.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
};
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const BASIC = { reply: 'I can still help with Evorez, this site, EZseed, the music, or getting in touch. Ask me about any of those.', model: 'local' };
const PERSONA = [
  'You are the assistant living on Evorez\' personal site (evorez.in).',
  'Evorez is a self-taught web builder. The site is a single HTML file with music, a binary backdrop, and this chat.',
  'Voice: calm, dry, a little playful. Answer in plain English, in 1 or 2 short sentences by default.',
  'No markdown or HTML. Never claim to be a person or invent facts about Evorez.',
  'Never output phone numbers, addresses or private emails. Public contact is evorez.alive@gmail.com.',
  'EZseed is the Java and Bedrock Minecraft seed map at https://evorez.in/ezseed/.',
].join(' ');

type Line = { role: string; content: string };
type Reply = { text: string; model: string };
type Delta = (text: string) => void;

function geminiKey() {
  const preferred = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (preferred) return preferred;
  const alias = Deno.env.get('API')?.trim() ?? '';
  return /^(?:AIza|AQ\.)[A-Za-z0-9_-]{16,150}$/.test(alias) ? alias : '';
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

function sb(path: string, body: unknown, signal: AbortSignal) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'POST', signal,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function claim(session: string, signal: AbortSignal): Promise<{ allowed: boolean; history?: Line[] }> {
  const res = await sb('rpc/claim_chat_turn', { p_session_id: session }, AbortSignal.any([signal, AbortSignal.timeout(3000)]));
  if (!res.ok) throw new Error(`chat admission HTTP ${res.status}`);
  const result = await res.json();
  if (typeof result?.allowed !== 'boolean') throw new Error('chat admission returned invalid data');
  return result;
}

async function save(session: string, message: string, reply: string) {
  try {
    const res = await sb('chat_messages', [
      { session_id: session, role: 'user', content: message },
      { session_id: session, role: 'assistant', content: reply },
    ], AbortSignal.timeout(2000));
    if (!res.ok) console.warn(`[chat] save HTTP ${res.status}`);
  } catch { console.warn('[chat] save timed out or failed'); }
}

function candidateText(packet: any): string {
  const candidate = packet?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKLIST') return '';
  const parts = candidate?.content?.parts;
  return Array.isArray(parts) ? parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('') : '';
}

async function geminiStream(response: Response, delta: Delta) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '', full = '', data: string[] = [], blocked = false;
  const flush = () => {
    if (!data.length) return;
    const raw = data.join('\n');
    data = [];
    if (raw === '[DONE]') return;
    const packet = JSON.parse(raw);
    const finish = packet?.candidates?.[0]?.finishReason;
    if (finish === 'SAFETY' || finish === 'BLOCKLIST') blocked = true;
    const chunk = candidateText(packet);
    if (chunk && !blocked) { full += chunk; delta(chunk); }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
        else if (line === '') flush();
      }
      if (done) break;
    }
    return blocked ? '' : full.trim();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function askGemini(message: string, hist: Line[], signal: AbortSignal, delta?: Delta): Promise<Reply | null> {
  const key = geminiKey();
  if (!key) return null;
  const contents = [
    ...hist.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(8500)]);
  try {
    for (const model of MODELS) {
      const payload = JSON.stringify({
        systemInstruction: { parts: [{ text: PERSONA }] }, contents,
        generationConfig: { maxOutputTokens: 256, temperature: 0.7,
          ...(model === MODELS[0] ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}) },
      });
      const call = (stream: boolean) => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`,
        { method: 'POST', signal: deadline, redirect: 'error',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: payload },
      );
      let res = await call(!!delta);
      if (delta && [404, 405, 501].includes(res.status)) {
        await res.body?.cancel();
        res = await call(false);
      }
      if (!res.ok) {
        console.warn(`[chat] Gemini ${model}: HTTP ${res.status}`);
        await res.body?.cancel();
        if (res.status === 404) continue;
        return null;
      }
      const text = delta && res.body && res.headers.get('content-type')?.includes('text/event-stream')
        ? await geminiStream(res, delta) : candidateText(await res.json()).trim();
      if (text) return { text, model };
      return null;
    }
  } catch { if (!signal.aborted) console.warn('[chat] Gemini request failed or timed out'); }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let body: { session_id?: string; message?: string } | null;
  try { body = await req.json(); }
  catch { return json({ error: 'bad json' }, 400); }
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1200) : '';
  const session = typeof body?.session_id === 'string' && /^[A-Za-z0-9_-]{5,64}$/.test(body.session_id) ? body.session_id : 'anon';
  if (!message) return json({ error: 'empty message' }, 400);
  let turn;
  try { turn = await claim(session, req.signal); }
  catch { return json(BASIC); }
  // Even at the daily cap, quick answers don't call a model or add to the chat log.
  if (!turn.allowed) return json(BASIC);
  const hist = Array.isArray(turn.history) ? turn.history : [];

  if (!req.headers.get('accept')?.includes('text/event-stream')) {
    const result = await askGemini(message, hist, req.signal);
    if (!result) return json(BASIC);
    await save(session, message, result.text);
    return json({ reply: result.text, model: result.model });
  }

  const cancel = new AbortController();
  const signal = AbortSignal.any([req.signal, cancel.signal]);
  const bytes = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        if (!signal.aborted) controller.enqueue(bytes.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        emit({ type: 'ready' });
        const result = await askGemini(message, hist, signal, (text) => emit({ type: 'delta', text }));
        if (result) {
          // Keep sending disabled until the thread is available for the next turn.
          await save(session, message, result.text);
          emit({ type: 'done', reply: result.text, model: result.model });
        } else emit({ type: 'done', ...BASIC });
      } catch { if (!signal.aborted) emit({ type: 'done', ...BASIC }); }
      finally { if (!cancel.signal.aborted) controller.close(); }
    },
    cancel() { cancel.abort(); },
  });
  return new Response(stream, { headers: { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform' } });
});
