// Run: npm run diagnose  -> tells you exactly why the AI request fails.
const dns = require('dns').promises, net = require('net'), fs = require('fs');
try { fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { console.log('No .env file found next to diagnose.js'); }
const E = process.env, P = (E.LLM_PROVIDER || 'gemini').toLowerCase();
const host = P === 'groq' ? 'api.groq.com' : 'generativelanguage.googleapis.com';
const key = P === 'groq' ? E.GROQ_API_KEY : E.GEMINI_API_KEY;
const tcp = (h, ms = 8000) => new Promise(r => { const s = net.connect({ host: h, port: 443, timeout: ms }); s.on('connect', () => { s.destroy(); r('OK'); }); s.on('timeout', () => { s.destroy(); r('TIMEOUT'); }); s.on('error', e => r(e.code || e.message)); });
(async () => {
  console.log('Node', process.version, '| provider:', P, '| key loaded:', !!key, key ? '| key starts: ' + key.slice(0, 4) : '');
  console.log('Proxy env vars:', E.HTTPS_PROXY || E.HTTP_PROXY || E.https_proxy || 'none (Node ignores system proxies)');
  try { console.log('DNS', host, '->', (await dns.lookup(host, { all: true })).map(a => a.address).join(', ')); } catch (e) { console.log('DNS FAILED:', e.code, '=> no internet/DNS blocked'); }
  console.log('TCP 443 to', host, ':', await tcp(host), '(TIMEOUT/ECONNREFUSED => your network blocks it; try a mobile hotspot or another provider)');
  console.log('TCP 443 to google.com:', await tcp('google.com'), '(OK here but not above => that specific API is blocked)');
  if (key) try {
    const url = P === 'groq' ? 'https://api.groq.com/openai/v1/models' : 'https://generativelanguage.googleapis.com/v1beta/models';
    const r = await fetch(url, { headers: P === 'groq' ? { Authorization: 'Bearer ' + key } : { 'x-goog-api-key': key }, signal: AbortSignal.timeout(12000) });
    console.log('API key check: HTTP', r.status, r.status === 200 ? '=> KEY WORKS' : '=> ' + (await r.text()).slice(0, 200));
  } catch (e) { console.log('API request failed:', e.name === 'TimeoutError' ? 'TIMEOUT => network blocks this API' : e.message, e.cause?.code || ''); }
})();
