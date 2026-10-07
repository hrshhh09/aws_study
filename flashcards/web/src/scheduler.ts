export type Box = 0 | 1 | 2 | 3 | 4 | 5;
export type Grade = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export interface CardProgress { box: Box; lastSeen: number; due: number; seen: number; correct: number; starred?: boolean }

const DAY = 86_400_000;
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
export const MASTERED_BOX = 4;

export function newProgress(): CardProgress {
  return { box: 0, lastSeen: 0, due: 0, seen: 0, correct: 0 };
}

export function grade(p: CardProgress | undefined, g: Grade, now = Date.now()): CardProgress {
  const cur = p ?? newProgress();
  let box: number = cur.box;
  let due: number;
  if (g === 1) { box = 0; due = now; }
  else if (g === 2) { due = now + DAY; }
  else { box = Math.min(5, box + (g === 3 ? 1 : 2)); due = now + INTERVAL_DAYS[box] * DAY; }
  return { ...cur, box: box as Box, due, lastSeen: now, seen: cur.seen + 1, correct: cur.correct + (g >= 3 ? 1 : 0) };
}

export const isDue = (p: CardProgress | undefined, now = Date.now()) => !p || p.due <= now;
export const isMastered = (p: CardProgress | undefined) => !!p && p.box >= MASTERED_BOX;
