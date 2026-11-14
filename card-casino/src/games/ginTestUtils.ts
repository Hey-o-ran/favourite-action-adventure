import type { Card, Suit } from '../cards';
import { dealHand, type GinHand, type Phase, type Who } from './ginRules';

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };

/** Cards from text like "Ts 6h Ac". */
export const cards = (text: string): Card[] =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ({ rank: RANK[t[0]] ?? Number(t[0]), suit: SUIT[t[1]] }));

/** A cheap filler stock that is long enough to play from, made of cards that appear nowhere else in the tests. */
export const filler = (n: number): Card[] => Array.from({ length: n }, (_, i) => ({ rank: (i % 13) + 1, suit: (['clubs', 'diamonds', 'hearts', 'spades'] as Suit[])[Math.floor(i / 13) % 4] }));

interface HandSpec {
  player: string;
  bot: string;
  /** The pile, top card last. */
  discard?: string;
  stock?: string;
  turn?: Who;
  phase?: Phase;
  dealer?: Who;
  passes?: number;
  taken?: string;
  playerTook?: string;
}

/** A hand in exactly the state a test wants, without dealing. */
export function handOf(spec: HandSpec): GinHand {
  const base = dealHand(filler(40), spec.dealer ?? 'bot');
  return {
    ...base,
    player: cards(spec.player),
    bot: cards(spec.bot),
    discard: cards(spec.discard ?? '2c'),
    stock: spec.stock ? cards(spec.stock) : filler(20),
    turn: spec.turn ?? 'player',
    phase: spec.phase ?? 'discard',
    dealer: spec.dealer ?? 'bot',
    passes: spec.passes ?? 0,
    taken: spec.taken ? cards(spec.taken)[0] : null,
    playerTook: cards(spec.playerTook ?? ''),
    result: null,
  };
}
