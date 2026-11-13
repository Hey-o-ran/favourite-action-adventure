import type { Card } from '../cards';

/** Weakest to strongest. A score's first number is an index into this list. */
export const CATEGORY_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
] as const;

/** Aces are high, except in the A-2-3-4-5 straight. */
const value = (card: Card) => (card.rank === 1 ? 14 : card.rank);

/**
 * Scores exactly five cards as a list of numbers: the category first, then the tiebreakers in order of
 * importance. Comparing two scores number by number (see `compareScores`) says which hand wins.
 */
export function scoreFive(cards: readonly Card[]): number[] {
  const values = cards.map(value).sort((a, b) => b - a);
  const flush = cards.every((c) => c.suit === cards[0].suit);

  // Groups of equal ranks, biggest group first, then highest rank first.
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map(([, n]) => n).join('');
  const byGroup = groups.map(([v]) => v);

  const distinct = groups.length === 5;
  const wheel = distinct && values[0] === 14 && values[1] === 5; // A-5-4-3-2
  const straight = distinct && (values[0] - values[4] === 4 || wheel);
  const straightHigh = wheel ? 5 : values[0];

  if (straight && flush) return [8, straightHigh];
  if (shape === '41') return [7, ...byGroup];
  if (shape === '32') return [6, ...byGroup];
  if (flush) return [5, ...values];
  if (straight) return [4, straightHigh];
  if (shape === '311') return [3, ...byGroup];
  if (shape === '221') return [2, ...byGroup];
  if (shape === '2111') return [1, ...byGroup];
  return [0, ...values];
}

/** Positive if `a` beats `b`, negative if `b` wins, 0 for an exact tie (the pot is split). */
export function compareScores(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface BestHand {
  score: number[];
  /** The five cards that make the hand. */
  cards: Card[];
  name: string;
}

export const handName = (score: readonly number[]) =>
  score[0] === 8 && score[1] === 14 ? 'Royal Flush' : CATEGORY_NAMES[score[0]];

/** The best five-card hand that can be made from 5 to 7 cards (a player's two plus the board). */
export function bestHand(cards: readonly Card[]): BestHand {
  if (cards.length < 5 || cards.length > 7) throw new Error(`Need 5 to 7 cards, got ${cards.length}`);

  let best = null as { score: number[]; cards: Card[] } | null;
  const pick: Card[] = [];
  const search = (start: number) => {
    if (pick.length === 5) {
      const score = scoreFive(pick);
      if (!best || compareScores(score, best.score) > 0) best = { score, cards: [...pick] };
      return;
    }
    for (let i = start; i < cards.length; i++) {
      pick.push(cards[i]);
      search(i + 1);
      pick.pop();
    }
  };
  search(0);

  const result = best!;
  return { ...result, name: handName(result.score) };
}
