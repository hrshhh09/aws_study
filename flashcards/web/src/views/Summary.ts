import { lastSession, navigate, subtopicTitle } from '../state';
import { esc } from '../md';

export function Summary(root: HTMLElement) {
  const r = lastSession.results;
  if (!r.length) { navigate('#/'); return; }
  const counts = [0, 0, 0, 0, 0];
  r.forEach((x) => counts[x.grade]++);
  const correct = counts[3] + counts[4];
  const pct = Math.round((100 * correct) / r.length);
  const bySub = new Map<string, { n: number; miss: number; label: string }>();
  for (const x of r) {
    const k = `${x.card.deckId}:${x.card.subtopic}`;
    const s = bySub.get(k) ?? { n: 0, miss: 0, label: subtopicTitle(x.card.deckId, x.card.subtopic) };
    s.n++; if (x.grade <= 2) s.miss++;
    bySub.set(k, s);
  }
  const weak = [...bySub.values()].filter((s) => s.miss).sort((a, b) => b.miss / b.n - a.miss / a.n).slice(0, 5);
  const missed = [...new Set(r.filter((x) => x.grade <= 2).map((x) => x.card.id))];
  const labels = ['', 'Again', 'Hard', 'Good', 'Easy'];

  root.innerHTML = `
    <section class="summary">
      <h1>Session complete 🎉</h1>
      <div class="big-stat">${pct}%<span class="muted"> correct (${correct}/${r.length})</span></div>
      <div class="grades">${[1, 2, 3, 4].map((g) => `<div class="g g${g}"><b>${counts[g]}</b><span>${labels[g]}</span></div>`).join('')}</div>
      ${weak.length ? `<h2>Weakest subtopics</h2><ul class="weak">${weak.map((s) => `<li>${esc(s.label)} <span class="muted">— ${s.miss}/${s.n} missed</span></li>`).join('')}</ul>` : ''}
      <div class="row">
        ${missed.length ? `<button class="btn primary" id="restudy">Restudy missed (${missed.length})</button>` : ''}
        <button class="btn" id="home">Home</button>
      </div>
    </section>`;
  root.querySelector<HTMLButtonElement>('#home')!.onclick = () => navigate('#/');
  const rb = root.querySelector<HTMLButtonElement>('#restudy');
  if (rb) rb.onclick = () => navigate(`#/study?ids=${missed.join(',')}&start=1`);
}
