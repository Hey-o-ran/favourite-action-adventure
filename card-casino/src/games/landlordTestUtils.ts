import type { Suit } from '../cards';
import type { LCard } from './landlordRules';

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14, '2': 15 };

let next = 1000;

/**
 * Cards from text like "3s 5h Ts As 2c x X": the rank, then the suit (s, h, d, c). `x` is the small joker and `X`
 * the big joker. Passing `pool` reuses the same card (same id) when it is already in it, so a test can play cards
 * out of a hand it wrote down.
 */
export function cards(text: string, pool: readonly LCard[] = []): LCard[] {
  const available = [...pool];
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const rank = token === 'x' ? 16 : token === 'X' ? 17 : (RANK[token[0]] ?? Number(token[0]));
      const suit = token.length > 1 ? SUIT[token[1]] : undefined;
      const at = available.findIndex((c) => c.rank === rank && c.suit === suit);
      if (at >= 0) return available.splice(at, 1)[0];
      return { id: next++, rank, ...(suit && { suit }) } as LCard;
    });
}

/** The ranks of a play, lowest first, as a string: the same for any cards of those ranks. */
export const rankSignature = (play: readonly LCard[]): string =>
  [...play]
    .map((c) => c.rank)
    .sort((a, b) => a - b)
    .join(',');

/** A small deterministic random number generator, so a test that deals random hands always deals the same ones. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
