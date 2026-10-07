import type { CardProgress } from './scheduler';

const KEY = 'flashcards:v1';
const META_KEY = 'flashcards:meta';
export type ProgressMap = Record<string, CardProgress>;

let state: ProgressMap = read();
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
    for (const [id, p] of Object.entries(other)) {
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
  if (typeof data !== 'object' || Array.isArray(data) || data === null) throw new Error('Not a progress file');
  store.merge(data as ProgressMap);
}
