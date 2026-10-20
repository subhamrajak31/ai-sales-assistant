# VoiceSales AI

Browser voice sales bot: speech recognition -> Gemini (via server proxy) -> speech synthesis.

## Run
1. Node 18+. Copy `.env.example` to `.env` and add your Gemini key (get one free at Google AI Studio).
2. `npm start`, then open http://localhost:3000 in Chrome or Edge.

## Structure
- `server.js` serves the UI and proxies `/api/llm` (key stays server-side), `/health` for checks.
- `public/index.html` UI, call state machine, sales state, consent + recording, analysis, history.

## Limits
Recording captures the customer microphone only (browser TTS can't be captured). History and recordings live in browser storage. Speech recognition requires Chrome/Edge/Safari.
