import { describe, expect, it } from 'vitest';
import { newDeck, shuffle, type Card, type Suit } from '../cards';
import { bestHand, compareScores, scoreFive } from './pokerHands';
import {
  BIG_BLIND,
  BUY_IN,
  act,
  betSize,
  legalActions,
  startHand,
  type HoldemState,
} from './holdemRules';

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };

/** Cards from text, like "As Kh 9d" (rank then suit). */
function cards(text: string): Card[] {
  return text.split(' ').map((t) => ({ rank: RANK[t[0]] ?? Number(t[0]), suit: SUIT[t[1]] }));
}
const score = (text: string) => scoreFive(cards(text));
const beats = (a: string, b: string) => compareScores(score(a), score(b)) > 0;

describe('poker hand scoring', () => {
  it('recognises every category', () => {
    expect(score('Ts 9s 8s 7s 6s')[0]).toBe(8); // straight flush
    expect(score('9s 9h 9d 9c 2s')[0]).toBe(7); // four of a kind
    expect(score('9s 9h 9d 2c 2s')[0]).toBe(6); // full house
    expect(score('As 9s 7s 4s 2s')[0]).toBe(5); // flush
    expect(score('9s 8h 7d 6c 5s')[0]).toBe(4); // straight
    expect(score('9s 9h 9d Kc 2s')[0]).toBe(3); // three of a kind
    expect(score('9s 9h 4d 4c 2s')[0]).toBe(2); // two pair
    expect(score('9s 9h 7d 4c 2s')[0]).toBe(1); // one pair
    expect(score('As Jh 7d 4c 2s')[0]).toBe(0); // high card
  });

  it('names the royal flush', () => {
    expect(bestHand(cards('As Ks Qs Js Ts')).name).toBe('Royal Flush');
    expect(bestHand(cards('9s 8s 7s 6s 5s')).name).toBe('Straight Flush');
  });

  it('treats A-2-3-4-5 as the lowest straight, and the ace as high otherwise', () => {
    expect(score('As 2h 3d 4c 5s')).toEqual([4, 5]);
    expect(beats('6s 5h 4d 3c 2s', 'As 2h 3d 4c 5s')).toBe(true);
    expect(beats('As Kh Qd Jc Ts', '6s 5h 4d 3c 2s')).toBe(true);
    // No wrapping round the corner: Q-K-A-2-3 is only a high card.
    expect(score('Qs Kh Ad 2c 3s')[0]).toBe(0);
  });

  it('ranks by category, then by the tiebreakers', () => {
    expect(beats('2s 2h 2d 3c 3s', 'As Ah Ad Kc Qs')).toBe(true); // full house beats trips
    expect(beats('As Ah 7d 4c 2s', 'Ks Kh 7d 4c 2s')).toBe(true); // higher pair
    expect(beats('As Ah 7d 4c 3s', 'As Ah 7d 4c 2s')).toBe(true); // last kicker decides
    expect(beats('Ks Kh 4d 4c 2s', 'Qs Qh Jd Jc As')).toBe(true); // top pair first
    expect(beats('Ks Kh 4d 4c 3s', 'Ks Kh 4d 4c 2s')).toBe(true); // then the kicker
    expect(beats('Ks Kh Kd 2c 9s', 'Qs Qh Qd Ac Ks')).toBe(true); // higher trips beat better kickers
    expect(beats('9s 9h 9d 9c 2s', '8s 8h 8d 8c As')).toBe(true); // higher quads
    expect(beats('Ks 9s 7s 4s 2s', 'Qs Js Ts 3s 2s')).toBe(true); // flush decided card by card
  });

  it('ties exactly equal hands, whatever the suits', () => {
    expect(compareScores(score('As Kh 9d 5c 2s'), score('Ac Kd 9h 5s 2d'))).toBe(0);
  });

  it('finds the best five of seven', () => {
    // Pair of aces in the hole plus a board with a heart flush and a straight draw: the flush wins.
    expect(bestHand(cards('As Ks 2s 9s 4s 3d Kh')).name).toBe('Flush');
    // Two sets of three: the higher three plays with the lower as the pair.
    const house = bestHand(cards('3s 3h 3d 2c 2s 2h Kd'));
    expect(house.name).toBe('Full House');
    expect(house.score).toEqual([6, 3, 2]);
    // Three pairs: the best two pair play, with the best remaining card as kicker.
    expect(bestHand(cards('As Ah Kd Kc Qs Qh 2d')).score).toEqual([2, 14, 13, 12]);
    // Straight beats the pair that is also present.
    expect(bestHand(cards('9s 8h 7d 6c 5s 5h 2d')).name).toBe('Straight');
  });

  it('needs between five and seven cards', () => {
    expect(() => bestHand(cards('As Ks Qs Js'))).toThrow();
    expect(() => bestHand(cards('As Ks Qs Js Ts 9s 8s 7s'))).toThrow();
  });
});

/**
 * A deck that deals the given hole cards and board. Cards go round the table twice starting from the
 * small blind (the seat left of the button), then the flop, turn and river come off the top.
 */
function rigged(button: number, holes: string[], board: string): Card[] {
  const hands = holes.map(cards);
  const order = [1, 2, 0].map((n) => (button + n) % 3);
  const deal: Card[] = [];
  for (let round = 0; round < 2; round++) for (const seat of order) deal.push(hands[seat][round]);
  return [...deal, ...cards(board)];
}

const stacks = (s: HoldemState) => s.seats.map((x) => x.stack);
const total = (s: HoldemState) => s.seats.reduce((n, x) => n + x.stack, 0) + (s.over ? 0 : s.pot);

/** Calls or checks until the hand is over. */
function checkDown(s: HoldemState): HoldemState {
  let state = s;
  while (!state.over) state = act(state, legalActions(state).check ? 'check' : 'call');
  return state;
}

describe('starting a hand', () => {
  const deck = rigged(0, ['As Ah', 'Ks Kh', '9s 9h'], '2c 3d 4h 5s 7c');

  it('posts the blinds, deals two cards each and starts with the button', () => {
    const s = startHand([100, 100, 100], 0, deck);
    expect(s.seats.map((x) => x.hole.length)).toEqual([2, 2, 2]);
    expect(stacks(s)).toEqual([100, 99, 98]); // seat 1 is the small blind, seat 2 the big blind
    expect(s.pot).toBe(3);
    expect(s.currentBet).toBe(BIG_BLIND);
    expect(s.toAct).toBe(0);
    expect(s.board).toEqual([]);
  });

  it('gives every seat the hole cards the deck was built for', () => {
    const s = startHand([100, 100, 100], 0, deck);
    expect(s.seats[0].hole).toEqual(cards('As Ah'));
    expect(s.seats[1].hole).toEqual(cards('Ks Kh'));
    expect(s.seats[2].hole).toEqual(cards('9s 9h'));
  });

  it('moves the blinds with the button', () => {
    const s = startHand([100, 100, 100], 1, shuffle(newDeck()));
    expect(stacks(s)).toEqual([98, 100, 99]); // seat 2 is small blind, seat 0 big blind
    expect(s.toAct).toBe(1);
  });

  it('refuses to start if a seat cannot cover the big blind', () => {
    expect(() => startHand([100, 100, 1], 0, deck)).toThrow();
    expect(() => startHand([100, 100], 0, deck)).toThrow();
  });
});

describe('betting rounds', () => {
  const deck = rigged(0, ['As Ah', 'Ks Kh', '9s 9h'], '2c 3d 4h 5s 7c');
  const fresh = () => startHand([100, 100, 100], 0, deck);

  it('offers the first player to act a call, raise or fold, but not a check', () => {
    expect(legalActions(fresh())).toMatchObject({ fold: true, check: false, call: true, callAmount: 2, raise: true, raiseTo: 4 });
  });

  it('gives the big blind the option to check once everyone has called', () => {
    let s = act(fresh(), 'call'); // button
    s = act(s, 'call'); // small blind completes
    expect(s.toAct).toBe(2);
    expect(s.street).toBe('preflop');
    expect(legalActions(s)).toMatchObject({ check: true, call: false, raise: true });
    s = act(s, 'check');
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.pot).toBe(6);
    expect(s.toAct).toBe(1); // first live seat left of the button
    expect(s.seats.map((x) => x.bet)).toEqual([0, 0, 0]);
  });

  it('bets 2 before the turn and 4 on the turn and river', () => {
    expect([betSize('preflop'), betSize('flop'), betSize('turn'), betSize('river')]).toEqual([2, 2, 4, 4]);
    let s = act(act(act(fresh(), 'call'), 'call'), 'check'); // to the flop
    for (let i = 0; i < 3; i++) s = act(s, 'check'); // through the flop
    expect(s.street).toBe('turn');
    expect(legalActions(s).raiseTo).toBe(4);
  });

  it('allows an opening bet and then two raises, and no more', () => {
    let s = act(act(act(fresh(), 'call'), 'call'), 'check'); // flop, seat 1 first
    s = act(s, 'raise'); // opening bet to 2
    expect(s.currentBet).toBe(2);
    s = act(s, 'raise'); // raise to 4
    s = act(s, 'raise'); // re-raise to 6
    expect(s.currentBet).toBe(6);
    expect(s.raises).toBe(2);
    expect(legalActions(s).raise).toBe(false);
    expect(legalActions(s).call).toBe(true);
  });

  it('limits preflop to two raises over the big blind', () => {
    let s = act(fresh(), 'raise'); // button raises to 4
    s = act(s, 'raise'); // small blind to 6
    expect(s.currentBet).toBe(6);
    expect(legalActions(s).raise).toBe(false); // big blind can only call or fold
  });

  it('puts the raise into the pot and makes the others respond', () => {
    let s = act(fresh(), 'raise'); // button to 4
    expect(s.pot).toBe(3 + 4);
    expect(stacks(s)).toEqual([96, 99, 98]);
    s = act(s, 'call'); // small blind
    expect(stacks(s)).toEqual([96, 96, 98]);
    expect(s.street).toBe('preflop'); // big blind still has to act
    s = act(s, 'call');
    expect(s.street).toBe('flop');
    expect(s.pot).toBe(12);
  });

  it('ignores actions that are not allowed', () => {
    const s = fresh();
    expect(act(s, 'check')).toBe(s); // can't check facing the big blind
    const s2 = act(act(s, 'call'), 'call');
    expect(act(s2, 'call')).toBe(s2); // the big blind has nothing to call
    expect(act(s2, 'fold')).toBe(s2); // and nothing to fold to
  });
});

describe('the hand ends', () => {
  it('awards the pot without a showdown when everyone else folds', () => {
    let s = startHand([100, 100, 100], 0, rigged(0, ['As Ah', 'Ks Kh', '9s 9h'], '2c 3d 4h 5s 7c'));
    s = act(s, 'fold'); // button
    s = act(s, 'fold'); // small blind
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([2]);
    expect(s.payouts).toEqual([0, 0, 3]);
    expect(stacks(s)).toEqual([100, 99, 101]);
    expect(s.handNames).toEqual([null, null, null]); // nobody showed anything
    expect(s.board).toHaveLength(0);
  });

  it('gives the pot to the best hand at showdown', () => {
    // Seat 0 flops trip aces against a pair-less seat 1 and a nothing hand in seat 2.
    const s = checkDown(startHand([100, 100, 100], 0, rigged(0, ['As Ah', 'Kd 7c', '9s 2d'], 'Ad 8c 4h Js 3c')));
    expect(s.street).toBe('showdown');
    expect(s.board).toHaveLength(5);
    expect(s.winners).toEqual([0]);
    expect(s.payouts).toEqual([6, 0, 0]);
    expect(stacks(s)).toEqual([104, 98, 98]);
    expect(s.handNames).toEqual(['Three of a Kind', 'High Card', 'High Card']);
  });

  it('splits the pot when the board plays', () => {
    const s = checkDown(startHand([100, 100, 100], 0, rigged(0, ['2d 3d', '4h 5h', '6c 7c'], 'As Ks Qs Js Ts')));
    expect(s.winners.sort()).toEqual([0, 1, 2]);
    expect(s.payouts).toEqual([2, 2, 2]);
    expect(stacks(s)).toEqual([100, 100, 100]);
  });

  it('gives the odd chip to the winner closest to the left of the button', () => {
    // Small blind (seat 1) folds, leaving a 5-chip pot. Seats 0 and 2 tie on the board.
    let s = startHand([100, 100, 100], 0, rigged(0, ['2d 3d', '4h 5h', '6c 7c'], 'As Ks Qs Js Ts'));
    s = act(s, 'call'); // button
    s = act(s, 'fold'); // small blind
    s = checkDown(s);
    expect(s.pot).toBe(5);
    expect(s.winners.sort()).toEqual([0, 2]);
    expect(s.payouts).toEqual([2, 0, 3]); // the big blind is nearer the left of the button than the button is
    expect(stacks(s).reduce((a, b) => a + b)).toBe(300);
  });
});

describe('no side pots: bets are capped at the shortest stack', () => {
  it('caps a raise at what the short stack can match', () => {
    // Seat 2 is the big blind with 3 chips: it posts 2 and has 1 left, so nobody can bet past 3.
    const s = startHand([100, 100, 3], 0, rigged(0, ['As Ah', 'Ks Kh', '9s 9h'], '2c 3d 4h 5s 7c'));
    expect(legalActions(s).raiseTo).toBe(3);
  });

  it('runs the board out when someone is all in, with no more betting', () => {
    let s = startHand([100, 100, 3], 0, rigged(0, ['As Ah', 'Ks Kh', '9s 9h'], '2c 3d 4h 5s 7c'));
    s = act(s, 'raise'); // button to 3, the most the short stack can match
    s = act(s, 'call'); // small blind
    s = act(s, 'call'); // big blind, all in
    expect(s.over).toBe(true);
    expect(s.street).toBe('showdown');
    expect(s.board).toHaveLength(5);
    expect(s.pot).toBe(9);
    expect(s.winners).toEqual([0]); // pocket aces hold up
    expect(stacks(s)).toEqual([106, 97, 0]);
  });

  it('keeps everyone left at showdown on equal footing', () => {
    // A seat cannot be forced to put in more than it has: every call fits in the stack.
    let s = startHand([100, 100, 10], 0, shuffle(newDeck()));
    for (let i = 0; i < 40 && !s.over; i++) {
      const a = legalActions(s);
      expect(a.callAmount).toBeLessThanOrEqual(s.seats[s.toAct!].stack);
      s = act(s, a.raise ? 'raise' : a.call ? 'call' : 'check');
    }
    expect(s.over).toBe(true);
    const live = s.seats.filter((x) => !x.folded);
    expect(new Set(live.map((x) => x.totalIn)).size).toBe(1);
  });
});

describe('simulated play', () => {
  /** A small repeatable random number generator, so a failure can be reproduced. */
  function randomFrom(seed: number) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /** Plays one hand with random legal actions, checking the chip count and rules at every step. */
  function playRandomHand(startStacks: number[], button: number, random: () => number) {
    const startTotal = startStacks.reduce((a, b) => a + b);
    let s = startHand(startStacks, button, shuffle(newDeck()));
    let sawAllIn = false;
    let actions = 0;

    while (!s.over) {
      expect(++actions).toBeLessThan(60);
      expect(total(s)).toBe(startTotal);
      expect(s.seats.every((x) => x.stack >= 0)).toBe(true);
      if (s.seats.some((x) => x.stack === 0)) sawAllIn = true;

      const a = legalActions(s);
      expect(a.callAmount).toBeLessThanOrEqual(s.seats[s.toAct!].stack); // every call fits in the stack
      const options = (['fold', 'check', 'call', 'raise'] as const).filter((k) => a[k]);
      expect(options.length).toBeGreaterThan(0);
      // Raise often so stacks go all in, but still fold and call sometimes.
      s = act(s, random() < 0.4 && a.raise ? 'raise' : options[Math.floor(random() * options.length)]);
    }

    expect(s.payouts.reduce((a, b) => a + b)).toBe(s.pot);
    expect(total(s)).toBe(startTotal);
    if (s.street !== 'showdown') expect(s.seats.filter((x) => !x.folded)).toHaveLength(1);
    else expect(s.board).toHaveLength(5);
    return { state: s, sawAllIn };
  }

  it('never creates or loses chips over a long session, and every hand finishes', () => {
    const random = randomFrom(12345);
    let held = [BUY_IN, BUY_IN, BUY_IN];
    let button = 0;
    let showdowns = 0;

    for (let hand = 0; hand < 3000; hand++) {
      // Bust seats re-buy, as the table will do for bots.
      const { state } = playRandomHand(held.map((n) => (n < BIG_BLIND ? BUY_IN : n)), button, random);
      if (state.street === 'showdown') showdowns++;
      held = stacks(state);
      button = (button + 1) % 3;
    }
    expect(showdowns).toBeGreaterThan(300);
  });

  it('stays correct with short, uneven stacks, where the cap and all-ins matter', () => {
    const random = randomFrom(98765);
    let allIns = 0;
    let showdownsWithAllIn = 0;

    for (let hand = 0; hand < 3000; hand++) {
      const startStacks = [0, 0, 0].map(() => BIG_BLIND + Math.floor(random() * 15));
      const { state, sawAllIn } = playRandomHand(startStacks, hand % 3, random);
      if (sawAllIn) allIns++;
      if (sawAllIn && state.street === 'showdown') showdownsWithAllIn++;
      // Nobody ever wins more than the pot, and everyone left put in the same amount.
      const live = state.seats.filter((x) => !x.folded);
      if (state.street === 'showdown') expect(new Set(live.map((x) => x.totalIn)).size).toBe(1);
    }
    expect(allIns).toBeGreaterThan(500);
    expect(showdownsWithAllIn).toBeGreaterThan(100);
  });
});
