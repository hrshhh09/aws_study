import Ajv2020 from 'ajv/dist/2020';
import schema from '../../deck.schema.json';
import type { Deck, DeckCard, DeckError } from './types';

const validate = new Ajv2020({ allErrors: true }).compile(schema);
const BASE = import.meta.env.BASE_URL;

export interface LoadResult { decks: Deck[]; cards: DeckCard[]; errors: DeckError[] }

export async function loadDecks(): Promise<LoadResult> {
  const errors: DeckError[] = [];
  let files: string[] = [];
  try {
    const r = await fetch(`${BASE}index.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    files = await r.json();
  } catch (e) {
    return { decks: [], cards: [], errors: [{ file: 'index.json', errors: [`Could not load manifest: ${(e as Error).message}`] }] };
  }

  const raw = await Promise.all(
    files.map(async (file) => {
      try {
        const r = await fetch(`${BASE}${file}`, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { file, data: (await r.json()) as unknown };
      } catch (e) {
        errors.push({ file, errors: [`Fetch/parse failed: ${(e as Error).message}`] });
        return null;
      }
    }),
  );

  const seen = new Map<string, string>();
  const decks: Deck[] = [];
  for (const item of raw) {
    if (!item) continue;
    const errs: string[] = [];
    if (!validate(item.data)) {
      errs.push(...(validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`));
    } else {
      const deck = item.data as unknown as Deck;
      const subs = new Set([...deck.deck.subtopics.map((s) => s.id), 'patterns', 'pocket-card']);
      for (const c of deck.cards) {
        if (seen.has(c.id)) errs.push(`Duplicate card id ${c.id} (also in ${seen.get(c.id)})`);
        if (!subs.has(c.subtopic)) errs.push(`${c.id}: unknown subtopic "${c.subtopic}"`);
        if (c.choices && c.choices.filter((x) => x.correct).length !== 1) errs.push(`${c.id}: MCQ must have exactly one correct choice`);
      }
      if (!errs.length) {
        deck.cards.forEach((c) => seen.set(c.id, item.file));
        decks.push(deck);
      }
    }
    if (errs.length) errors.push({ file: item.file, errors: errs });
  }
  decks.sort((a, b) => a.deck.section - b.deck.section);
  const cards = decks.flatMap((d) => d.cards.map((c) => ({ ...c, deckId: d.deck.id })));
  return { decks, cards, errors };
}
