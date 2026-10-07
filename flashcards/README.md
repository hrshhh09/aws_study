# AWS SAA Flashcards

```
flashcards/
  deck.schema.json, decks/      ← deck data (served as static files)
  web/                          ← frontend (Vite + TS)  → Vercel
  worker/                       ← optional sync API (Cloudflare Worker + KV) → Cloudflare
```

The site works fully **without** the backend (progress lives in `localStorage`, export/import JSON).
The Worker adds cross-device **cloud sync** keyed by a secret sync code.

## Local dev
```bash
cd web && npm install && npm run dev        # http://localhost:5173
npm run validate                            # ajv-check all decks
npm run manifest                            # regenerate decks/index.json (also runs on dev/build)

cd ../worker && npm install && npm run dev  # http://localhost:8787
# then in web/.env.local:  VITE_API_URL=http://localhost:8787
```

## Deploy backend → Cloudflare Workers
```bash
cd worker
npx wrangler login
npx wrangler kv namespace create PROGRESS   # paste the id into wrangler.toml
# edit ALLOWED_ORIGINS in wrangler.toml to your Vercel URL
npx wrangler deploy                          # → https://flashcards-api.<you>.workers.dev
```

## Deploy frontend → Vercel
1. Import the repo in Vercel; set **Root Directory = `flashcards/web`** (it reads `../decks` and `../deck.schema.json`, which Vercel includes).
2. Framework preset: Vite (already in `vercel.json`).
3. Env var `VITE_API_URL = https://flashcards-api.<you>.workers.dev` (leave it out to disable sync).
4. Deploy. Add the final Vercel domain to `ALLOWED_ORIGINS` and run `wrangler deploy` again.

## Using sync
Home → Cloud sync → **New code** → **Sync now**. On a second device, paste the same code and press Sync.
Progress merges per card, and the most recent review wins.

## Shortcuts
Space flip · 1–4 grade · ←/→ navigate · A–D pick MCQ choice · S star · / search · Esc end.
On mobile, swipe left/right to move between cards. Once a card is flipped, swipe left = Again and swipe right = Good.
