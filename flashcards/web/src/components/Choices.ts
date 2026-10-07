import { mdInline } from '../md';
import type { Choice } from '../types';

const LETTERS = 'ABCDEFGH';

export function choicesHTML(choices: Choice[], picked: number | null) {
  return `<ol class="choices">${choices
    .map((ch, i) => {
      let cls = '';
      if (picked !== null) cls = ch.correct ? 'correct' : i === picked ? 'wrong' : 'dim';
      return `<li><button type="button" class="choice ${cls}" data-choice="${i}" ${picked !== null ? 'disabled' : ''}>
        <span class="letter">${LETTERS[i]}</span><span class="txt">${mdInline(ch.text)}${
          picked !== null && ch.why ? `<small class="why">${mdInline(ch.why)}</small>` : ''
        }</span></button></li>`;
    })
    .join('')}</ol>`;
}
