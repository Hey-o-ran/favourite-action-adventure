import { describe, expect, it } from 'vitest';
import type { Card } from '../cards';
import { handValue, dealRound, stand, stakeOf, type Round } from './blackjackRules';
import { evaluateHand } from './videoPokerRules';
import { newKlondike, moveCards, outcome, type KState } from './klondikeRules';
import { guessHigherLower, guessJackpot, startHigherLower } from './higherLowerRules';
import { dealThird, startRedDog } from './redDogRules';

const c = (rank: number, suit: Card['suit'] = 'spades'): Card => ({ rank, suit });

function round(player: Card[], dealer: Card[], bet = 10, extra: Partial<Round> = {}): Round {
  return { deck: [], player, dealer, bet, doubled: false, over: false, returned: 0, ...extra };
}

describe('blackjack', () => {
  it('counts aces as 11 or 1 to avoid busting', () => {
    expect(handValue([c(1), c(13)])).toEqual({ total: 21, soft: true });
    expect(handValue([c(1), c(13), c(9)])).toEqual({ total: 20, soft: false });
    expect(handValue([c(1), c(1), c(9)])).toEqual({ total: 21, soft: true });
  });

  it('pays 3:2 for a natural and 1:1 for a normal win', () => {
    const natural = stand(round([c(1), c(13)], [c(10), c(8)]));
    expect(natural.outcome).toBe('blackjack');
    expect(natural.returned).toBe(25); // 10 bet -> 25 back

    const win = stand(round([c(10), c(10)], [c(10), c(7)]));
    expect(win.outcome).toBe('win');
    expect(win.returned).toBe(20);
  });

  it('loses the stake on a bust and returns it on a push', () => {
    const bust = stand(round([c(10), c(10), c(5)], [c(10), c(7)]));
    expect(bust.outcome).toBe('bust');
    expect(bust.returned).toBe(0);

    const push = stand(round([c(10), c(9)], [c(10), c(9)]));
    expect(push.outcome).toBe('push');
    expect(push.returned).toBe(10);
  });

  it('doubles the stake and settles the doubled amount', () => {
    const doubled = { ...round([c(10), c(9)], [c(10), c(7)]), doubled: true };
    expect(stakeOf(doubled)).toBe(20);
    const result = stand(doubled);
    expect(result.outcome).toBe('win');
    expect(result.returned).toBe(40);
  });

  it('settles immediately when the dealt hand is a natural', () => {
    const deck: Card[] = [c(1, 'hearts'), c(10, 'hearts'), c(9, 'clubs'), c(8, 'clubs')];
    const r = dealRound(deck, 10);
    expect(r.over).toBe(true);
  });
});

describe('video poker hand evaluation', () => {
  it('recognises the main hands', () => {
    expect(evaluateHand([c(1), c(10), c(11), c(12), c(13)]).name).toBe('Royal Flush');
    expect(evaluateHand([c(5, 'hearts'), c(6, 'hearts'), c(7, 'hearts'), c(8, 'hearts'), c(9, 'hearts')]).name).toBe(
      'Straight Flush',
    );
    expect(evaluateHand([c(9), c(9, 'hearts'), c(9, 'clubs'), c(9, 'diamonds'), c(2)]).name).toBe('Four of a Kind');
    expect(evaluateHand([c(9), c(9, 'hearts'), c(9, 'clubs'), c(4), c(4, 'hearts')]).name).toBe('Full House');
    expect(evaluateHand([c(1), c(2, 'hearts'), c(3), c(4), c(5)]).name).toBe('Straight');
    expect(evaluateHand([c(2), c(2, 'hearts'), c(7), c(7, 'clubs'), c(12)]).name).toBe('Two Pair');
  });

  it('only pays a pair of jacks or better', () => {
    expect(evaluateHand([c(11), c(11, 'hearts'), c(2), c(5), c(8)]).multiplier).toBe(1);
    expect(evaluateHand([c(10), c(10, 'hearts'), c(2), c(5), c(8)]).multiplier).toBe(0);
  });
});

describe('klondike', () => {
  const deck: Card[] = [];
  for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }

  it('deals 28 cards to the tableau and 24 to the stock', () => {
    const s = newKlondike(deck);
    expect(s.tableau.reduce((n, col) => n + col.length, 0)).toBe(28);
    expect(s.stock.length).toBe(24);
    s.tableau.forEach((col) => expect(col[col.length - 1].up).toBe(true));
  });

  it('only allows legal tableau placements (opposite colour, one lower)', () => {
    const s: KState = {
      stock: [],
      waste: [c(6, 'hearts')],
      foundations: [[], [], [], []],
      tableau: [[{ rank: 7, suit: 'spades', up: true }], [], [], [], [], [], []],
      recyclesLeft: 0,
    };
    // 6 of hearts onto 7 of spades: legal.
    expect(moveCards(s, { from: 'waste' }, { to: 'tableau', col: 0 })).not.toBeNull();
    // 6 of hearts onto 7 of hearts: illegal (same colour).
    const bad: KState = { ...s, tableau: [[{ rank: 7, suit: 'hearts', up: true }], [], [], [], [], [], []] };
    expect(moveCards(bad, { from: 'waste' }, { to: 'tableau', col: 0 })).toBeNull();
  });

  it('reports a win when all foundations are complete', () => {
    const full = Array.from({ length: 4 }, (_, p) =>
      Array.from({ length: 13 }, (_, r) => ({ rank: r + 1, suit: (['clubs', 'diamonds', 'hearts', 'spades'] as const)[p] })),
    );
    const s: KState = { stock: [], waste: [], foundations: full, tableau: Array(7).fill([]), recyclesLeft: 0 };
    expect(outcome(s)).toBe('won');
  });
});

describe('higher or lower', () => {
  it('a tie is a loss and a correct guess grows the pot', () => {
    const base = startHigherLower([c(5), c(9)], 10);
    expect(guessHigherLower(base, 'higher').status).toBe('playing');
    expect(guessHigherLower(base, 'higher').pot).toBe(15);
    const tie = startHigherLower([c(5), c(5, 'hearts')], 10);
    expect(guessHigherLower(tie, 'higher').status).toBe('lost');
    expect(guessHigherLower(tie, 'lower').status).toBe('lost');
  });
});

describe('higher or lower jackpot', () => {
  it('pays 12× the pot when the next card has the same rank', () => {
    const s = startHigherLower([c(7), c(7, 'hearts')], 10);
    const won = guessJackpot(s);
    expect(won.status).toBe('jackpot');
    expect(won.pot).toBe(120);
  });

  it('loses the pot when the rank differs, even if higher or lower would have won', () => {
    const s = startHigherLower([c(7), c(9)], 10);
    expect(guessJackpot(s).status).toBe('lost');
  });
});

describe('red dog', () => {
  it('pays 5, 4, 2 and 1 to 1 as the spread widens', () => {
    expect(dealThird(startRedDog([c(4), c(6), c(5)], 10)).returned).toBe(60); // spread 1
    expect(dealThird(startRedDog([c(4), c(7), c(5)], 10)).returned).toBe(50); // spread 2
    expect(dealThird(startRedDog([c(4), c(8), c(6)], 10)).returned).toBe(30); // spread 3
    expect(dealThird(startRedDog([c(4), c(9), c(6)], 10)).returned).toBe(20); // spread 4
    expect(dealThird(startRedDog([c(2), c(13), c(7)], 10)).returned).toBe(20); // spread 10 is still 1 to 1
  });

  it('orders the opening cards and loses when the third card is outside or on a boundary', () => {
    const s = startRedDog([c(9), c(4), c(4, 'hearts')], 10);
    expect(s.cards.map((x) => x.rank)).toEqual([4, 9]);
    expect(dealThird(s)).toMatchObject({ status: 'lost', returned: 0 });
    expect(dealThird(startRedDog([c(4), c(9), c(9, 'hearts')], 10)).status).toBe('lost');
    expect(dealThird(startRedDog([c(4), c(9), c(13)], 10)).status).toBe('lost');
  });

  it('treats aces as high', () => {
    // 2 and Ace leave 3 to King in between.
    expect(dealThird(startRedDog([c(2), c(1), c(5)], 10)).status).toBe('won');
    // King and Ace are consecutive.
    expect(startRedDog([c(13), c(1), c(5)], 10)).toMatchObject({ status: 'push', spread: 0 });
  });

  it('pushes consecutive cards without dealing a third card', () => {
    const s = startRedDog([c(5), c(6), c(9)], 10);
    expect(s).toMatchObject({ status: 'push', returned: 10, third: null });
    expect(dealThird(s, 10)).toBe(s);
  });

  it('pays 11 to 1 for three of a kind and pushes any other third card after a pair', () => {
    expect(startRedDog([c(7), c(7, 'hearts'), c(7, 'clubs')], 10)).toMatchObject({ status: 'won', returned: 120 });
    expect(startRedDog([c(7), c(7, 'hearts'), c(8)], 10)).toMatchObject({ status: 'push', returned: 10 });
  });

  it('applies a raise to the stake, capped at the original bet', () => {
    const half = dealThird(startRedDog([c(4), c(9), c(6)], 10), 5);
    expect(half).toMatchObject({ raise: 5, returned: 30 }); // 15 staked at 1 to 1
    const capped = dealThird(startRedDog([c(4), c(9), c(6)], 10), 50);
    expect(capped).toMatchObject({ raise: 10, returned: 40 });
    expect(dealThird(startRedDog([c(4), c(9), c(2)], 10), 10).returned).toBe(0);
  });
});
