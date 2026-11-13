import { describe, expect, it } from 'vitest';
import { newDeck, shuffle, type Card, type Suit } from '../cards';
import { botAction, handStrength, postflopStrength, preflopStrength } from './holdemBots';
import { act, legalActions, startHand, type HoldemState } from './holdemRules';

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
/** Cards from text, like "As Kh 9d" (rank then suit). */
const cards = (text: string): Card[] => text.split(' ').map((t) => ({ rank: RANK[t[0]] ?? Number(t[0]), suit: SUIT[t[1]] }));

const pre = (text: string) => preflopStrength(cards(text));
const post = (hole: string, board: string) => postflopStrength(cards(hole), cards(board));

/** No randomness: the bot's judgement is exactly its hand strength. */
const steady = () => 0.5;

/**
 * A fresh hand with the button on seat 0, so seat 0 acts first.
 * Hole cards are given for seat 0, seat 1 (small blind) and seat 2 (big blind).
 */
function rigged(holes: [string, string, string], board = '2c 3d 4h 5s 7c'): HoldemState {
  const hands = holes.map(cards);
  const deal: Card[] = [];
  for (let round = 0; round < 2; round++) for (const seat of [1, 2, 0]) deal.push(hands[seat][round]);
  return startHand([100, 100, 100], 0, [...deal, ...cards(board)]);
}

describe('starting hands', () => {
  it('rates pocket aces the best and an unconnected low hand the worst', () => {
    expect(pre('As Ah')).toBe(1);
    expect(pre('7s 2d')).toBe(0);
  });

  it('puts pairs in order, and keeps the smallest pair above junk', () => {
    const pairs = ['As Ah', 'Ks Kh', 'Qs Qh', 'Js Jh', 'Ts Th', '8s 8h', '5s 5h', '2s 2h'].map(pre);
    expect([...pairs].sort((a, b) => b - a)).toEqual(pairs);
    expect(pre('2s 2h')).toBeGreaterThan(pre('9s 4d'));
  });

  it('likes suited and connected cards', () => {
    expect(pre('As Ks')).toBeGreaterThan(pre('As Kd'));
    expect(pre('9s 8s')).toBeGreaterThan(pre('9s 4s'));
    expect(pre('Js Ts')).toBeGreaterThan(pre('Js 6d'));
  });

  it('always stays between 0 and 1', () => {
    for (let i = 0; i < 500; i++) {
      const strength = preflopStrength(shuffle(newDeck()).slice(0, 2));
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    }
  });
});

describe('hands after the flop', () => {
  it('rates a made hand above a weaker one', () => {
    const board = '9s 5d 2c Kh 7d';
    const ranked = [
      post('Ac 3c', board), // ace high
      post('9c 3d', board), // pair of nines
      post('9c 5h', board), // two pair
      post('9h 9d', board), // three of a kind
      post('8c 6h', board), // straight, 5-6-7-8-9
      post('As 3s', '9s 5s 2s Kh 7d'), // flush
      post('9h 9d', '9s 5d 5c Kh 2d'), // full house
    ];
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked);
    expect(new Set(ranked).size).toBe(ranked.length);
  });

  it('values a pair that uses a hole card above a pair the board made', () => {
    expect(post('Ks 3d', 'Kd 8c 2h')).toBeGreaterThan(post('As Qd', '8d 8c 2h'));
    expect(post('As Qd', '8d 8c 2h')).toBeLessThan(0.25); // everyone shares that pair
  });

  it('gives a little extra for a draw, but less than a made hand', () => {
    const noDraw = post('As 9d', '2c 7h Jd');
    const flushDraw = post('As 9s', '2s 7s Jd');
    const straightDraw = post('9s 8d', '7c 6h Kd');
    expect(flushDraw).toBeGreaterThan(noDraw);
    expect(straightDraw).toBeGreaterThan(noDraw);
    expect(flushDraw).toBeLessThan(post('As 9s', '2s 7s Js')); // the made flush
  });

  it('gives no draw bonus once the last card is out', () => {
    expect(post('As 9s', '2s 7s Jd 3h Kc')).toBeLessThan(0.2);
  });
});

describe('what a bot does', () => {
  it('raises a monster when facing the big blind', () => {
    expect(botAction(rigged(['As Ah', '7d 2c', '8h 3d']), steady)).toBe('raise');
  });

  it('folds trash when facing the big blind', () => {
    expect(botAction(rigged(['7s 2d', 'Ad Ac', 'Kh Kd']), steady)).toBe('fold');
  });

  it('calls a playable hand rather than raising or folding', () => {
    const s = rigged(['Ts 9s', '7d 2c', '8h 3d']);
    expect(handStrength(s)).toBeGreaterThan(0.4);
    expect(handStrength(s)).toBeLessThan(0.6);
    expect(botAction(s, steady)).toBe('call');
  });

  it('checks when it is free to, with a hand that is not strong', () => {
    // The small blind completes and the big blind (seat 2) has the option, holding 8-3.
    const s = act(act(rigged(['9s 8s', '7d 2c', '8h 3d']), 'call'), 'call');
    expect(s.toAct).toBe(2);
    expect(botAction(s, steady)).toBe('check');
  });

  it('bets a strong hand when it is free to', () => {
    const s = act(act(rigged(['9s 8s', '7d 2c', 'Ah Ad']), 'call'), 'call');
    expect(botAction(s, steady)).toBe('raise');
  });

  it('only calls when the raises have run out, even with a monster', () => {
    let s = rigged(['9s 8s', '7d 2c', 'Ah Ad']);
    s = act(s, 'raise'); // to 4
    s = act(s, 'raise'); // to 6, the second raise
    expect(s.toAct).toBe(2);
    expect(legalActions(s).raise).toBe(false);
    expect(botAction(s, steady)).toBe('call');
  });

  it('never bluffs: it does not raise with a weak hand, whatever the dice say', () => {
    const s = act(act(rigged(['9s 8s', '7d 2c', '7h 2d']), 'call'), 'call'); // big blind option holding 7-2
    for (const dice of [0, 0.25, 0.5, 0.75, 0.999]) expect(botAction(s, () => dice)).toBe('check');
  });

  it('is a little unpredictable on a borderline hand', () => {
    const s = rigged(['9s 8s', 'Ad Ac', 'Kh Kd']); // suited nine-eight facing the big blind sits right on the line
    const choices = new Set([0, 0.2, 0.4, 0.6, 0.8, 1].map((dice) => botAction(s, () => dice)));
    expect(choices.size).toBeGreaterThan(1);
  });

  it('asks for a better hand when the price is higher', () => {
    // The same weak hand (nine-eight offsuit) is not worth 2 on the button into a pot of 3...
    const onTheButton = rigged(['9s 8d', '9c 8h', '7d 2c']);
    expect(botAction(onTheButton, steady)).toBe('fold');
    // ...but the small blind only owes 1 more into a pot of 5 once the button has called, so it completes.
    const smallBlind = act(onTheButton, 'call');
    expect(smallBlind.toAct).toBe(1);
    expect(legalActions(smallBlind).callAmount).toBe(1);
    expect(botAction(smallBlind, steady)).toBe('call');
  });
});

describe('bots playing whole hands', () => {
  it('only ever choose legal moves, never fold for free, and always finish the hand', () => {
    for (let hand = 0; hand < 1500; hand++) {
      let s = startHand([100, 100, 100], hand % 3, shuffle(newDeck()));
      let steps = 0;
      while (!s.over) {
        expect(++steps).toBeLessThan(60);
        const action = botAction(s);
        if (legalActions(s).check) expect(action).not.toBe('fold');
        const next = act(s, action);
        expect(next).not.toBe(s); // the move was legal
        s = next;
      }
      expect(s.seats.reduce((n, seat) => n + seat.stack, 0)).toBe(300);
      expect(s.seats.every((seat) => seat.stack >= 0)).toBe(true);
    }
  });

  it('fold some hands and raise others, so they are not just calling stations', () => {
    const moves = new Map<string, number>();
    for (let hand = 0; hand < 600; hand++) {
      let s = startHand([100, 100, 100], hand % 3, shuffle(newDeck()));
      while (!s.over) {
        const action = botAction(s);
        moves.set(action, (moves.get(action) ?? 0) + 1);
        s = act(s, action);
      }
    }
    for (const move of ['fold', 'check', 'call', 'raise']) expect(moves.get(move) ?? 0).toBeGreaterThan(50);
  });
});
