import type { LoadResult } from './loader';
import type { DeckCard } from './types';
import type { Grade } from './scheduler';

export const app: { data: LoadResult } = { data: { decks: [], cards: [], errors: [] } };

export interface SessionResult { card: DeckCard; grade: Grade }
export const lastSession: { results: SessionResult[]; query: string } = { results: [], query: '' };

export function navigate(hash: string) { location.hash = hash; }
export const subtopicTitle = (deckId: string, sub: string) =>
  app.data.decks.find((d) => d.deck.id === deckId)?.deck.subtopics.find((s) => s.id === sub)?.title ??
  (sub === 'patterns' ? 'Question patterns' : sub === 'pocket-card' ? 'Pocket card' : sub);
