import { drawCard, type Card } from '../cards';

/** The pot grows by this factor on each correct guess. */
export const POT_MULTIPLIER = 1.5;
/** A jackpot (next card has the same rank) pays this multiple of the current pot. The odds are 1 in 13. */
export const JACKPOT_MULTIPLIER = 12;

export interface HigherLowerState {
  deck: Card[];
  /** The card currently showing. */
  current: Card;
  bet: number;
  pot: number;
  streak: number;
  /** For 'jackpot', `pot` is already the jackpot payout. */
  status: 'playing' | 'lost' | 'cashed' | 'jackpot';
}

/** Aces are high here. */
const value = (card: Card) => (card.rank === 1 ? 14 : card.rank);

export function startHigherLower(deck: readonly Card[], bet: number): HigherLowerState {
  const [current, rest] = drawCard(deck);
  return { deck: rest, current, bet, pot: bet, streak: 0, status: 'playing' };
}

export function guessHigherLower(s: HigherLowerState, guess: 'higher' | 'lower'): HigherLowerState {
  if (s.status !== 'playing') return s;
  const [next, rest] = drawCard(s.deck);
  const a = value(s.current);
  const b = value(next);
  // A tie is a loss, which keeps the house edge.
  const correct = guess === 'higher' ? b > a : b < a;
  if (!correct) return { ...s, deck: rest, current: next, status: 'lost' };
  return {
    ...s,
    deck: rest,
    current: next,
    streak: s.streak + 1,
    pot: Math.max(s.pot + 1, Math.floor(s.pot * POT_MULTIPLIER)),
  };
}

/** Bets the next card has the same rank as the one showing. Resolves the round either way. */
export function guessJackpot(s: HigherLowerState): HigherLowerState {
  if (s.status !== 'playing') return s;
  const [next, rest] = drawCard(s.deck);
  if (next.rank === s.current.rank) {
    return { ...s, deck: rest, current: next, streak: s.streak + 1, pot: s.pot * JACKPOT_MULTIPLIER, status: 'jackpot' };
  }
  return { ...s, deck: rest, current: next, status: 'lost' };
}

export function cashOutHigherLower(s: HigherLowerState): HigherLowerState {
  if (s.status !== 'playing' || s.streak === 0) return s;
  return { ...s, status: 'cashed' };
}

/** The pot after one more correct guess, for display. */
export const nextPot = (pot: number) => Math.max(pot + 1, Math.floor(pot * POT_MULTIPLIER));
