import { CARD_TYPES, type DeckCard } from '../types';
import { esc } from '../md';
import { subtopicTitle } from '../state';

export interface FilterState { subtopics: Set<string>; types: Set<string>; difficulty: Set<number>; tags: Set<string>; starred: boolean }
export const emptyFilters = (): FilterState => ({ subtopics: new Set(), types: new Set(), difficulty: new Set(), tags: new Set(), starred: false });

export function applyFilters(cards: DeckCard[], f: FilterState, isStarred: (id: string) => boolean) {
  return cards.filter((c) =>
    (!f.subtopics.size || f.subtopics.has(`${c.deckId}:${c.subtopic}`)) &&
    (!f.types.size || f.types.has(c.type)) &&
    (!f.difficulty.size || f.difficulty.has(c.difficulty)) &&
    (!f.tags.size || c.tags.some((t) => f.tags.has(t))) &&
    (!f.starred || isStarred(c.id)));
}

const chip = (group: string, value: string, label: string, on: boolean) =>
  `<button type="button" class="chip${on ? ' on' : ''}" data-group="${group}" data-value="${esc(value)}">${esc(label)}</button>`;

/** Renders filter chips into `el`; calls onChange after each toggle. */
export function renderFilters(el: HTMLElement, cards: DeckCard[], f: FilterState, onChange: () => void) {
  const subs = [...new Map(cards.map((c) => [`${c.deckId}:${c.subtopic}`, subtopicTitle(c.deckId, c.subtopic)])).entries()];
  const tags = [...new Set(cards.flatMap((c) => c.tags))].sort();
  const types = CARD_TYPES.filter((t) => cards.some((c) => c.type === t));
  const draw = () => {
    el.innerHTML = `
      <details class="filters" ${el.dataset.open ? 'open' : ''}>
        <summary>Filters${countActive(f) ? ` <span class="badge">${countActive(f)}</span>` : ''}</summary>
        <div class="filter-row"><span class="label">Type</span>${types.map((t) => chip('types', t, t, f.types.has(t))).join('')}</div>
        <div class="filter-row"><span class="label">Difficulty</span>${[1, 2, 3].map((d) => chip('difficulty', String(d), ['', 'recall', 'understand', 'apply'][d], f.difficulty.has(d))).join('')}
          ${chip('starred', '1', '★ starred', f.starred)}</div>
        <div class="filter-row"><span class="label">Subtopic</span>${subs.map(([k, v]) => chip('subtopics', k, v, f.subtopics.has(k))).join('')}</div>
        ${tags.length ? `<div class="filter-row"><span class="label">Tags</span>${tags.map((t) => chip('tags', t, '#' + t, f.tags.has(t))).join('')}</div>` : ''}
      </details>`;
    el.querySelector('details')!.addEventListener('toggle', (e) => {
      el.dataset.open = (e.target as HTMLDetailsElement).open ? '1' : '';
    });
  };
  el.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!b) return;
    const { group, value } = b.dataset as { group: string; value: string };
    if (group === 'starred') f.starred = !f.starred;
    else {
      const set = f[group as 'types'] as Set<string | number>;
      const v = group === 'difficulty' ? Number(value) : value;
      set.has(v) ? set.delete(v) : set.add(v);
    }
    draw();
    onChange();
  };
  draw();
}
const countActive = (f: FilterState) => f.subtopics.size + f.types.size + f.difficulty.size + f.tags.size + (f.starred ? 1 : 0);
