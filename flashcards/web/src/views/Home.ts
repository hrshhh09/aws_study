import { app, navigate } from '../state';
import { store, exportProgress, importProgress } from '../store';
import { isDue, isMastered } from '../scheduler';
import { esc } from '../md';
import { syncEnabled, syncNow, newSyncCode } from '../sync';

export function Home(root: HTMLElement) {
  const { decks, cards, errors } = app.data;
  const stats = (ids: string[]) => {
    const p = store.all();
    return { total: ids.length, mastered: ids.filter((id) => isMastered(p[id])).length, due: ids.filter((id) => isDue(p[id])).length };
  };
  const all = stats(cards.map((c) => c.id));
  const bar = (s: { total: number; mastered: number }) => {
    const pct = s.total ? Math.round((100 * s.mastered) / s.total) : 0;
    return `<div class="progress"><div style="width:${pct}%"></div></div><span class="muted">${pct}% mastered</span>`;
  };
  const meta = store.meta.get();

  root.innerHTML = `
    <section class="hero">
      <h1>AWS SAA-C03 Flashcards</h1>
      <p class="muted">${cards.length} cards · ${decks.length} deck${decks.length === 1 ? '' : 's'} · <b>${all.due}</b> due</p>
      ${bar(all)}
      <div class="row">
        <button class="btn primary" data-go="#/study?deck=all" ${cards.length ? '' : 'disabled'}>Study all decks</button>
        <button class="btn" data-go="#/browse">Browse all</button>
      </div>
    </section>

    ${errors.length ? `<section class="errors"><h2>⚠️ Deck errors</h2>${errors
      .map((e) => `<details><summary><code>${esc(e.file)}</code> — ${e.errors.length} problem(s)</summary><ul>${e.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`)
      .join('')}</section>` : ''}

    <section class="deck-grid">
      ${decks.map((d) => {
        const s = stats(d.cards.map((c) => c.id));
        return `<article class="deck">
          <div class="deck-head"><span class="section-no">${d.deck.section}</span><h3>${esc(d.deck.title)}</h3></div>
          ${d.deck.analogy ? `<p class="analogy">${esc(d.deck.analogy)}</p>` : ''}
          <p class="muted">${s.total} cards · <b>${s.due}</b> due</p>
          ${bar(s)}
          <div class="row">
            <button class="btn primary" data-go="#/study?deck=${d.deck.id}">Study</button>
            <button class="btn" data-go="#/browse?deck=${d.deck.id}">Browse</button>
          </div>
        </article>`;
      }).join('')}
    </section>

    <section class="tools">
      <h2>Progress</h2>
      <div class="row">
        <button class="btn" id="export">Export JSON</button>
        <label class="btn">Import JSON<input type="file" accept="application/json" id="import" hidden /></label>
        <button class="btn danger" id="reset">Reset</button>
      </div>
      ${syncEnabled ? `
      <h3>Cloud sync</h3>
      <p class="muted small">Use the same sync code on each device to share progress. Keep it secret — it's your key.</p>
      <div class="row">
        <input id="sync-code" class="input" placeholder="sync code" value="${esc(meta.syncCode ?? '')}" autocomplete="off" />
        <button class="btn" id="gen-code">New code</button>
        <button class="btn primary" id="sync">Sync now</button>
      </div>
      <p class="muted small" id="sync-status">${meta.lastSync ? 'Last synced ' + new Date(meta.lastSync).toLocaleString() : 'Never synced'}</p>` : ''}
    </section>`;

  root.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => (b.onclick = () => navigate(b.dataset.go!)));
  root.querySelector<HTMLButtonElement>('#export')!.onclick = exportProgress;
  root.querySelector<HTMLInputElement>('#import')!.onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { await importProgress(f); Home(root); } catch (err) { alert('Import failed: ' + (err as Error).message); }
  };
  root.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
    if (confirm('Erase all local progress?')) { store.replace({}); Home(root); }
  };
  if (syncEnabled) {
    const input = root.querySelector<HTMLInputElement>('#sync-code')!;
    const status = root.querySelector<HTMLElement>('#sync-status')!;
    const save = () => store.meta.set({ ...store.meta.get(), syncCode: input.value.trim() || undefined });
    input.onchange = save;
    root.querySelector<HTMLButtonElement>('#gen-code')!.onclick = () => { input.value = newSyncCode(); save(); };
    root.querySelector<HTMLButtonElement>('#sync')!.onclick = async () => {
      save(); status.textContent = 'Syncing…';
      try { status.textContent = await syncNow(); setTimeout(() => Home(root), 800); } catch (err) { status.textContent = (err as Error).message; }
    };
  }
}
