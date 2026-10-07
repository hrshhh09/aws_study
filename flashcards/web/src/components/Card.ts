import { md, mdInline, esc } from '../md';
import type { DeckCard } from '../types';
import { subtopicTitle } from '../state';

export function cardFrontHTML(c: DeckCard, starred: boolean) {
  return `
    <div class="card-meta">
      <span class="type type-${c.type}">${c.type}</span>
      <span class="diff" title="difficulty">${'●'.repeat(c.difficulty)}${'○'.repeat(3 - c.difficulty)}</span>
      <span class="sub">${esc(subtopicTitle(c.deckId, c.subtopic))}</span>
      <button type="button" class="star${starred ? ' on' : ''}" data-action="star" aria-label="Star card">${starred ? '★' : '☆'}</button>
    </div>
    <div class="md front-text">${md(c.front)}</div>`;
}

export function cardBackHTML(c: DeckCard) {
  const b = c.back;
  return `
    <div class="answer md">${md(b.answer)}</div>
    ${b.explanation ? `<div class="explanation md">${md(b.explanation)}</div>` : ''}
    ${b.mnemonic ? `<div class="mnemonic">💡 ${mdInline(b.mnemonic)}</div>` : ''}
    ${b.code ? `<pre class="code"><code>${esc(b.code)}</code></pre>` : ''}
    ${c.examTip ? `<div class="examtip"><span class="badge tip">Exam tip</span> ${mdInline(c.examTip)}</div>` : ''}
    <div class="source">§ ${esc(c.sourceHeading)} · <code>${esc(c.id)}</code></div>`;
}

/** 3D flip card. Front face + back face; `.flipped` class rotates. */
export function flipCardHTML(c: DeckCard, starred: boolean, extraFront = '') {
  return `
    <div class="flip" data-action="flip" tabindex="0" role="button" aria-label="Flip card">
      <div class="flip-inner">
        <section class="face front">${cardFrontHTML(c, starred)}${extraFront}<div class="hint">Tap or press Space to flip</div></section>
        <section class="face back"><div class="md back-q">${md(c.front)}</div><hr/>${cardBackHTML(c)}</section>
      </div>
    </div>`;
}
