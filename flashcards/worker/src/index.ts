/**
 * Flashcards progress-sync API (Cloudflare Worker + KV).
 *
 *   GET  /health                → { ok: true }
 *   GET  /progress/:code        → stored progress map (404 if none)
 *   PUT  /progress/:code        → merge body into stored map (newest lastSeen wins), returns merged map
 *
 * `code` is an unguessable 32-hex-char sync code generated on the client; it acts as the key.
 */
export interface Env { PROGRESS: KVNamespace; ALLOWED_ORIGINS: string }

type CardProgress = { box: number; lastSeen: number; due: number; seen: number; correct: number; starred?: boolean };
type ProgressMap = Record<string, CardProgress>;

const CODE_RE = /^[a-f0-9]{32}$/;
const MAX_BODY = 1_000_000; // 1 MB

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim());
  const ok = allowed.includes('*') || allowed.includes(origin);
  return {
    'access-control-allow-origin': ok ? origin || '*' : allowed[0] ?? '',
    'access-control-allow-methods': 'GET,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (data: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json' } });

function isProgressMap(x: unknown): x is ProgressMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  return Object.entries(x).every(([k, v]) => k.length <= 64 && v && typeof v === 'object' && typeof (v as CardProgress).box === 'number');
}

function merge(a: ProgressMap, b: ProgressMap): ProgressMap {
  const out = { ...a };
  for (const [id, p] of Object.entries(b)) if (!out[id] || (p.lastSeen ?? 0) >= (out[id].lastSeen ?? 0)) out[id] = p;
  return out;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, h);

    const m = url.pathname.match(/^\/progress\/([^/]+)$/);
    if (!m) return json({ error: 'not found' }, 404, h);
    const code = m[1];
    if (!CODE_RE.test(code)) return json({ error: 'invalid sync code (32 hex chars)' }, 400, h);
    const key = `p:${code}`;

    if (req.method === 'GET') {
      const v = await env.PROGRESS.get(key);
      return v ? new Response(v, { headers: { ...h, 'content-type': 'application/json' } }) : json({ error: 'no data' }, 404, h);
    }
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: 'too large' }, 413, h);
      let body: unknown;
      try { body = JSON.parse(text); } catch { return json({ error: 'invalid json' }, 400, h); }
      if (!isProgressMap(body)) return json({ error: 'invalid progress map' }, 400, h);
      const existing = ((await env.PROGRESS.get(key, 'json')) as ProgressMap | null) ?? {};
      const merged = merge(existing, body);
      await env.PROGRESS.put(key, JSON.stringify(merged));
      return json(merged, 200, h);
    }
    return json({ error: 'method not allowed' }, 405, h);
  },
};
