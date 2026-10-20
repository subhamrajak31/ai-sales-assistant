// Serves the UI and proxies LLM calls so API keys never reach the browser.
// LLM_PROVIDER=gemini (default) or groq. Both have free tiers.
const http = require('http'), fs = require('fs'), path = require('path');
try { fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) {}
const E = process.env, PROVIDER = (E.LLM_PROVIDER || 'gemini').toLowerCase(), PORT = E.PORT || 3000;
const MODEL = E.LLM_MODEL || (PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-2.5-flash');
const KEY = PROVIDER === 'groq' ? E.GROQ_API_KEY : E.GEMINI_API_KEY;
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

async function callLLM(prompt) {
  if (!KEY) throw new Error((PROVIDER === 'groq' ? 'GROQ_API_KEY' : 'GEMINI_API_KEY') + ' is not set in .env');
  const signal = AbortSignal.timeout(30000);
  if (PROVIDER === 'groq') {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.6 }) });
    const j = await r.json(); const t = j.choices?.[0]?.message?.content;
    if (!t) throw new Error(j.error?.message || 'Empty Groq response (HTTP ' + r.status + ')'); return t;
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }) });
  const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw new Error(j.error?.message || 'Empty Gemini response (HTTP ' + r.status + ')'); return t;
}

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, provider: PROVIDER, model: MODEL, keyLoaded: !!KEY });
  if (req.method === 'POST' && req.url === '/api/llm') {
    let b = ''; req.on('data', d => { b += d; if (b.length > 100000) req.destroy(); });
    return req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(b);
        if (typeof prompt !== 'string' || !prompt) throw new Error('prompt required');
        send(res, 200, { text: await callLLM(prompt) });
      } catch (e) {
        const why = e.name === 'TimeoutError' ? 'timed out reaching ' + PROVIDER + ' (network blocked? run: npm run diagnose)' : e.message + (e.cause ? ' (' + (e.cause.code || e.cause.message) + ')' : '');
        console.error(new Date().toISOString(), why); send(res, 500, { error: why });
      }
    });
  }
  if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(fs.readFileSync(path.join(__dirname, 'public/index.html'))); }
  send(res, 404, { error: 'not found' });
}).listen(PORT, () => console.log(`Running on http://localhost:${PORT}  provider=${PROVIDER} model=${MODEL} key=${KEY ? 'loaded' : 'MISSING'}`));
