import { drawCard, type Card } from '../cards';

/** Winning payout (profit per coin staked) for each spread, i.e. how many ranks sit between the two opening cards. */
export const SPREAD_PAYOUTS = [
  { spread: 1, payout: 5 },
  { spread: 2, payout: 4 },
  { spread: 3, payout: 2 },
] as const;
/** Spreads of 4 or more pay this. */
export const WIDE_SPREAD_PAYOUT = 1;
/** A pair followed by a third card of the same rank pays this (profit per coin). */
export const THREE_OF_A_KIND_PAYOUT = 11;

export const spreadPayout = (spread: number) =>
  SPREAD_PAYOUTS.find((p) => p.spread === spread)?.payout ?? WIDE_SPREAD_PAYOUT;

/** Aces are high here. */
const value = (card: Card) => (card.rank === 1 ? 14 : card.rank);

export interface RedDogState {
  deck: Card[];
  /** The two opening cards, lower first. */
  cards: [Card, Card];
  /** The card dealt after the player decides. Null while deciding, and after consecutive cards. */
  third: Card | null;
  bet: number;
  /** Extra stake added after seeing the spread, never more than `bet`. */
  raise: number;
  /** Ranks strictly between the opening cards. 0 means consecutive, -1 means a pair. */
  spread: number;
  status: 'decide' | 'won' | 'lost' | 'push';
  /** Coins handed back, including the stake. Zero for a loss, and meaningless while deciding. */
  returned: number;
}

export function startRedDog(deck: readonly Card[], bet: number): RedDogState {
  const [a, afterA] = drawCard(deck);
  const [b, afterB] = drawCard(afterA);
  const cards: [Card, Card] = value(a) <= value(b) ? [a, b] : [b, a];
  const spread = value(cards[1]) - value(cards[0]) - 1;
  const base = { deck: afterB, cards, third: null, bet, raise: 0, spread, returned: 0 };

  // Consecutive cards can't have anything between them, so the hand is a push and can't be raised.
  if (spread === 0) return { ...base, status: 'push', returned: bet };

  // A pair resolves straight away: a matching third card pays big, anything else is a push.
  if (spread < 0) {
    const [third, rest] = drawCard(afterB);
    if (value(third) === value(cards[0])) {
      return { ...base, deck: rest, third, status: 'won', returned: bet * (1 + THREE_OF_A_KIND_PAYOUT) };
    }
    return { ...base, deck: rest, third, status: 'push', returned: bet };
  }

  return { ...base, status: 'decide' };
}

/**
 * Deals the third card. `raise` adds to the stake and is capped at the original bet,
 * so the caller must wager `raise` from the wallet first (use the returned `raise`, not the argument).
 */
export function dealThird(s: RedDogState, raise = 0): RedDogState {
  if (s.status !== 'decide') return s;
  const extra = Math.min(Math.max(0, Math.floor(raise)), s.bet);
  const [third, rest] = drawCard(s.deck);
  // Landing on either opening card loses, so the third card must be strictly between them.
  const won = value(third) > value(s.cards[0]) && value(third) < value(s.cards[1]);
  const stake = s.bet + extra;
  return {
    ...s,
    deck: rest,
    third,
    raise: extra,
    status: won ? 'won' : 'lost',
    returned: won ? stake * (1 + spreadPayout(s.spread)) : 0,
  };
}
