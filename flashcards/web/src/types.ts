export type CardType = 'concept' | 'compare' | 'trap' | 'scenario' | 'signal' | 'fact';
export interface Choice { text: string; correct: boolean; why?: string | null }
export interface Card {
  id: string;
  type: CardType;
  subtopic: string;
  front: string;
  back: { answer: string; explanation?: string | null; mnemonic?: string | null; code?: string | null };
  choices?: Choice[] | null;
  difficulty: 1 | 2 | 3;
  tags: string[];
  sourceHeading: string;
  examTip?: string | null;
}
export interface Deck {
  schemaVersion: '1.0';
  deck: { id: string; section: number; title: string; sourceFile: string; analogy?: string | null; subtopics: { id: string; title: string }[] };
  cards: Card[];
}
/** Card annotated with the deck it came from. */
export interface DeckCard extends Card { deckId: string }
export interface DeckError { file: string; errors: string[] }
export const CARD_TYPES: CardType[] = ['concept', 'compare', 'trap', 'scenario', 'signal', 'fact'];
