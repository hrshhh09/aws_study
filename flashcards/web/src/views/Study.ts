import { app, lastSession, navigate } from '../state';
import { store } from '../store';
import { grade as gradeCard, isDue, type Grade } from '../scheduler';
import { applyFilters, emptyFilters, renderFilters } from '../components/Filters';
import { flipCardHTML } from '../components/Card';
import { choicesHTML } from '../components/Choices';
import { autoSync } from '../sync';
import type { DeckCard } from '../types';
import { esc } from '../md';

type Mode = 'due' | 'shuffle' | 'order';
const PREF_KEY = 'flashcards:studyPrefs';

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

let cleanup: (() => void) | null = null;
export function stopStudy() { cleanup?.(); cleanup = null; }

export function Study(root: HTMLElement, params: URLSearchParams) {
  stopStudy();
  const deckId = params.get('deck') ?? 'all';
  const ids = params.get('ids')?.split(',');
  const pool = ids
    ? app.data.cards.filter((c) => ids.includes(c.id))
    : app.data.cards.filter((c) => deckId === 'all' || c.deckId === deckId);
  const title = ids ? 'Restudy missed' : deckId === 'all' ? 'All decks' : app.data.decks.find((d) => d.deck.id === deckId)?.deck.title ?? deckId;
  const prefs: { mode: Mode; mcq: boolean } = { mode: 'due', mcq: true, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') };
  const filters = emptyFilters();

  // ---------- setup screen ----------
  const setup = () => {
    root.innerHTML = `
      <h1>${esc(title)}</h1>
      <div class="setup">
        <div class="seg" role="radiogroup" aria-label="Order">
          ${(['due', 'shuffle', 'order'] as Mode[]).map((m) => `<button type="button" data-mode="${m}" class="${prefs.mode === m ? 'on' : ''}">${{ due: 'Due first', shuffle: 'Shuffle', order: 'In order' }[m]}</button>`).join('')}
        </div>
        <label class="toggle"><input type="checkbox" id="mcq" ${prefs.mcq ? 'checked' : ''}/> MCQ mode for cards with choices</label>
        <div id="filters"></div>
        <button class="btn primary big" id="start"></button>
      </div>`;
    const startBtn = root.querySelector<HTMLButtonElement>('#start')!;
    const count = () => {
      const n = buildQueue().length;
      startBtn.textContent = n ? `Start · ${n} card${n === 1 ? '' : 's'}` : 'No cards match';
      startBtn.disabled = !n;
    };
    root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => (b.onclick = () => {
      prefs.mode = b.dataset.mode as Mode;
      root.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
      count();
    }));
    root.querySelector<HTMLInputElement>('#mcq')!.onchange = (e) => (prefs.mcq = (e.target as HTMLInputElement).checked);
    renderFilters(root.querySelector('#filters')!, pool, filters, count);
    startBtn.onclick = () => { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); run(buildQueue()); };
    count();
  };

  const buildQueue = (): DeckCard[] => {
    const f = applyFilters(pool, filters, (id) => !!store.get(id)?.starred);
    if (prefs.mode === 'order') return f;
    if (prefs.mode === 'shuffle') return shuffle(f);
    // due first: due cards (lowest box first, shuffled within), then the rest by soonest due
    const now = Date.now();
    const due = shuffle(f.filter((c) => isDue(store.get(c.id), now))).sort((a, b) => (store.get(a.id)?.box ?? 0) - (store.get(b.id)?.box ?? 0));
    const later = f.filter((c) => !isDue(store.get(c.id), now)).sort((a, b) => store.get(a.id)!.due - store.get(b.id)!.due);
    return due.length ? due : later;
  };

  // ---------- session ----------
  const run = (queue: DeckCard[]) => {
    let i = 0;
    let flipped = false;
    let picked: number | null = null;
    const graded = new Map<number, Grade>(); // queue index → grade
    lastSession.results = [];

    const card = () => queue[i];
    const useMcq = () => prefs.mcq && !!card().choices?.length;

    const draw = () => {
      const c = card();
      const starred = !!store.get(c.id)?.starred;
      const extra = useMcq() ? choicesHTML(c.choices!, picked) : '';
      const done = graded.size;
      root.innerHTML = `
        <div class="study-top">
          <button class="icon-btn" id="quit" aria-label="End session">✕</button>
          <div class="progress"><div style="width:${(100 * done) / queue.length}%"></div></div>
          <span class="counter">${i + 1} / ${queue.length}</span>
        </div>
        <div class="stage">${flipCardHTML(c, starred, extra)}</div>
        <div class="study-bottom">
          <div class="grade-bar ${flipped ? '' : 'hidden'}">
            ${(['Again', 'Hard', 'Good', 'Easy'] as const).map((l, k) => `<button class="grade g${k + 1}" data-grade="${k + 1}"><b>${l}</b><kbd>${k + 1}</kbd></button>`).join('')}
          </div>
          <div class="nav-bar">
            <button class="btn" id="prev" ${i === 0 ? 'disabled' : ''} aria-label="Previous">←</button>
            <button class="btn primary" id="flipbtn">${flipped ? 'Show question' : useMcq() && picked === null ? 'Reveal answer' : 'Flip'}</button>
            <button class="btn" id="next" aria-label="Next">→</button>
          </div>
        </div>`;
      const flipEl = root.querySelector<HTMLElement>('.flip')!;
      if (flipped) flipEl.classList.add('flipped');
      if (useMcq() && !flipped) flipEl.classList.add('mcq');
    };

    const flip = () => { flipped = !flipped; draw(); };
    const go = (d: number) => {
      const n = i + d;
      if (n < 0) return;
      if (n >= queue.length) return finish();
      i = n; flipped = false; picked = null; draw();
    };
    const doGrade = (g: Grade) => {
      if (!flipped) return;
      const c = card();
      store.set(c.id, { ...gradeCard(store.get(c.id), g), starred: store.get(c.id)?.starred });
      lastSession.results.push({ card: c, grade: g });
      graded.set(i, g);
      autoSync();
      if (g === 1) queue.splice(Math.min(queue.length, i + 6), 0, c); // requeue ~5 cards later
      go(1);
    };
    const pick = (k: number) => {
      if (!useMcq() || picked !== null || flipped || k >= card().choices!.length) return;
      picked = k; draw();
    };
    const finish = () => { stopStudy(); navigate('#/summary'); };

    root.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('#quit')) return lastSession.results.length ? finish() : navigate('#/');
      if (t.closest('[data-action=star]')) { store.toggleStar(card().id); draw(); return; }
      const ch = t.closest<HTMLElement>('[data-choice]');
      if (ch) return pick(Number(ch.dataset.choice));
      const gb = t.closest<HTMLElement>('[data-grade]');
      if (gb) return doGrade(Number(gb.dataset.grade) as Grade);
      if (t.closest('#prev')) return go(-1);
      if (t.closest('#next')) return go(1);
      if (t.closest('#flipbtn')) return flip();
      if (t.closest('[data-action=flip]') && !t.closest('a, button, pre')) {
        if (useMcq() && picked === null && !flipped) return; // must answer first
        flip();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') { e.preventDefault(); flip(); }
      else if (k >= '1' && k <= '4') doGrade(Number(k) as Grade);
      else if (k === 'arrowleft') go(-1);
      else if (k === 'arrowright') go(1);
      else if (k === 's') { store.toggleStar(card().id); draw(); }
      else if ('abcdefgh'.includes(k) && k.length === 1) pick('abcdefgh'.indexOf(k));
      else if (k === 'escape') root.querySelector<HTMLElement>('#quit')?.click();
    };

    // Swipe: left = Again, right = Good (only once flipped); otherwise left/right navigate.
    let sx = 0, sy = 0, st = 0;
    const onTouchStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); };
    const onTouchEnd = (e: TouchEvent) => {
      if (!(e.target as HTMLElement).closest('.stage')) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - st > 800) return;
      const flipEl = root.querySelector<HTMLElement>('.flip');
      flipEl?.classList.add(dx < 0 ? 'swipe-left' : 'swipe-right');
      setTimeout(() => {
        if (flipped) doGrade(dx < 0 ? 1 : 3);
        else go(dx < 0 ? 1 : -1);
      }, 150);
    };

    document.addEventListener('keydown', onKey);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchend', onTouchEnd);
    cleanup = () => {
      document.removeEventListener('keydown', onKey);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchend', onTouchEnd);
      root.onclick = null;
    };
    draw();
  };

  if (params.get('start') && pool.length) run(shuffle(pool));
  else setup();
}
