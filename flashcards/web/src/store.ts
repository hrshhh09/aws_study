import type { CardProgress } from './scheduler';

const KEY = 'flashcards:v1';
const META_KEY = 'flashcards:meta';
export type ProgressMap = Record<string, CardProgress>;

/** Keep only well-formed progress entries (guards against importing a deck file, etc.). */
export function sanitize(x: unknown): ProgressMap {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
  const out: ProgressMap = {};
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (k.length <= 64 && v && typeof v === 'object' && !Array.isArray(v) && typeof (v as CardProgress).box === 'number') out[k] = v as CardProgress;
  }
  return out;
}

let state: ProgressMap = sanitize(read());
const listeners = new Set<() => void>();

function read(): ProgressMap {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((f) => f());
}

export const store = {
  get: (id: string): CardProgress | undefined => state[id],
  all: (): ProgressMap => state,
  set(id: string, p: CardProgress) { state = { ...state, [id]: p }; persist(); },
  toggleStar(id: string) {
    const p = state[id] ?? { box: 0, lastSeen: 0, due: 0, seen: 0, correct: 0 };
    this.set(id, { ...p, starred: !p.starred });
  },
  replace(map: ProgressMap) { state = map; persist(); },
  /** Merge another map in, keeping the most recently seen entry per card. */
  merge(other: ProgressMap) {
    const out: ProgressMap = { ...state };
    for (const [id, p] of Object.entries(sanitize(other))) {
      const mine = out[id];
      if (!mine || (p.lastSeen ?? 0) > (mine.lastSeen ?? 0)) out[id] = p;
      else if (p.lastSeen === mine.lastSeen && p.starred !== mine.starred) out[id] = { ...mine, starred: mine.starred || p.starred };
    }
    state = out; persist();
  },
  subscribe(f: () => void) { listeners.add(f); return () => listeners.delete(f); },
  meta: {
    get(): { syncCode?: string; lastSync?: number } { try { return JSON.parse(localStorage.getItem(META_KEY) ?? '{}'); } catch { return {}; } },
    set(m: { syncCode?: string; lastSync?: number }) { localStorage.setItem(META_KEY, JSON.stringify(m)); },
  },
};

export function exportProgress() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `flashcards-progress-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function importProgress(file: File) {
  const data = JSON.parse(await file.text());
  const clean = sanitize(data);
  if (!Object.keys(clean).length) throw new Error('Not a progress file (did you pick a deck JSON? Decks go in flashcards/decks/)');
  store.merge(clean);
}
