// Optional cloud sync against the Cloudflare Worker backend (worker/).
import { store, type ProgressMap } from './store';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
export const syncEnabled = !!API;

export function newSyncCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Pull remote, merge locally, push merged result back. */
export async function syncNow(): Promise<string> {
  if (!API) throw new Error('Sync not configured (VITE_API_URL)');
  const meta = store.meta.get();
  if (!meta.syncCode) throw new Error('No sync code set');
  const url = `${API}/progress/${meta.syncCode}`;
  const r = await fetch(url);
  if (r.ok) store.merge((await r.json()) as ProgressMap);
  else if (r.status !== 404) throw new Error(`Pull failed: HTTP ${r.status}`);
  const w = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(store.all()) });
  if (!w.ok) throw new Error(`Push failed: HTTP ${w.status}`);
  store.meta.set({ ...meta, lastSync: Date.now() });
  return `Synced ${Object.keys(store.all()).length} cards`;
}

let timer: number | undefined;
/** Debounced background push after progress changes. */
export function autoSync() {
  if (!API || !store.meta.get().syncCode) return;
  clearTimeout(timer);
  timer = window.setTimeout(() => syncNow().catch(() => {}), 4000);
}
