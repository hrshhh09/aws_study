import { app } from '../state';
import { store } from '../store';
import { md, mdInline, esc } from '../md';
import { applyFilters, emptyFilters, renderFilters } from '../components/Filters';
import { flipCardHTML } from '../components/Card';
import { isMastered } from '../scheduler';

export function Browse(root: HTMLElement, params: URLSearchParams) {
  const deckId = params.get('deck');
  const pool = app.data.cards.filter((c) => !deckId || deckId === 'all' || c.deckId === deckId);
  const filters = emptyFilters();
  const title = deckId && deckId !== 'all' ? app.data.decks.find((d) => d.deck.id === deckId)?.deck.title ?? deckId : 'All cards';

  root.innerHTML = `
    <h1>${esc(title)}</h1>
    <input id="search" class="input search" type="search" placeholder="Search cards…  ( / )" value="${esc(params.get('q') ?? '')}" />
    <div id="filters"></div>
    <p class="muted small" id="count"></p>
    <ul class="card-list" id="list"></ul>
    <dialog id="dlg"><div id="dlg-body"></div><form method="dialog"><button class="btn">Close</button></form></dialog>`;

  const search = root.querySelector<HTMLInputElement>('#search')!;
  const list = root.querySelector<HTMLElement>('#list')!;
  const dlg = root.querySelector<HTMLDialogElement>('#dlg')!;
  const plain = (s: string) => s.toLowerCase();

  const draw = () => {
    const q = plain(search.value.trim());
    const rows = applyFilters(pool, filters, (id) => !!store.get(id)?.starred).filter(
      (c) => !q || plain(`${c.id} ${c.front} ${c.back.answer} ${c.back.explanation ?? ''} ${c.tags.join(' ')}`).includes(q),
    );
    root.querySelector('#count')!.textContent = `${rows.length} of ${pool.length} cards`;
    list.innerHTML = rows.map((c) => {
      const p = store.get(c.id);
      return `<li data-id="${c.id}" tabindex="0">
        <div class="li-head"><span class="type type-${c.type}">${c.type}</span>${p?.starred ? '<span class="starred">★</span>' : ''}${isMastered(p) ? '<span class="badge ok">mastered</span>' : ''}<code class="muted">${c.id}</code></div>
        <div class="md li-front">${md(c.front)}</div>
        <div class="li-answer">${mdInline(c.back.answer)}</div></li>`;
    }).join('');
  };

  list.onclick = (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]');
    if (!li) return;
    const c = pool.find((x) => x.id === li.dataset.id)!;
    const body = dlg.querySelector<HTMLElement>('#dlg-body')!;
    body.innerHTML = flipCardHTML(c, !!store.get(c.id)?.starred);
    body.onclick = (ev) => {
      const t = ev.target as HTMLElement;
      if (t.closest('[data-action=star]')) { store.toggleStar(c.id); ev.stopPropagation(); body.querySelector('.star')!.classList.toggle('on'); draw(); return; }
      if (t.closest('[data-action=flip]')) body.querySelector('.flip')!.classList.toggle('flipped');
    };
    dlg.showModal();
  };
  list.onkeydown = (e) => { if (e.key === 'Enter') (e.target as HTMLElement).click(); };
  search.oninput = draw;
  renderFilters(root.querySelector('#filters')!, pool, filters, draw);
  draw();
}
