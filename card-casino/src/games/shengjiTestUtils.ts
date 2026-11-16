import type { Suit } from '../cards';
import { BIG_JOKER, SMALL_JOKER, type SCard, type Trump } from './shengjiCards';

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };

let nextId = 1000;

/** Cards from text like "As Ks 5h BJ SJ". Each one gets its own id, so "5h 5h" is a pair of the same card. */
export const sc = (text: string): SCard[] =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token === 'BJ') return { id: nextId++, rank: BIG_JOKER, suit: 'joker' as const };
      if (token === 'SJ') return { id: nextId++, rank: SMALL_JOKER, suit: 'joker' as const };
      return { id: nextId++, rank: RANK[token[0]] ?? Number(token[0]), suit: SUIT[token[1]] };
    });

/** Hearts are trump and 5 is the level in most tests, so 4 and 6 are neighbours, and 5s are trump in every suit. */
export const HEARTS_5: Trump = { level: 5, suit: 'hearts' };
export const NO_TRUMP_5: Trump = { level: 5, suit: null };
