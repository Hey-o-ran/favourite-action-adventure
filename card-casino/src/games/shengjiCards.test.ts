import { describe, expect, it } from 'vitest';
import {
  analyze,
  cardName,
  checkFollow,
  checkThrow,
  decompose,
  domainOf,
  isThrow,
  makeDeck,
  pairsIn,
  pointsOf,
  positionOf,
  sortHand,
  structureOf,
  totalPoints,
  trickWinner,
  type Play,
  type SCard,
} from './shengjiCards';
import { HEARTS_5, NO_TRUMP_5, sc } from './shengjiTestUtils';

const T = HEARTS_5;
const pos = (text: string, trump = T) => positionOf(sc(text)[0], trump);
const play = (seat: number, text: string): Play => ({ seat, cards: sc(text) });
const shape = (text: string, trump = T) => structureOf(decompose(sc(text), trump));
/** The ids of a hand's cards written like text, so a play can be picked out of the hand by name. */
const pick = (hand: SCard[], text: string): SCard[] => {
  const wanted = sc(text);
  const free = [...hand];
  return wanted.map((w) => {
    const i = free.findIndex((c) => c.rank === w.rank && c.suit === w.suit);
    if (i < 0) throw new Error(`the hand has no ${text}`);
    return free.splice(i, 1)[0];
  });
};

describe('the deck', () => {
  it('has 108 cards: two of everything, with four jokers', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
    expect(deck.filter((c) => c.suit === 'joker')).toHaveLength(4);
    expect(deck.filter((c) => c.rank === 14 && c.suit === 'spades')).toHaveLength(2);
  });

  it('has 200 points: the 5s are 5 and the 10s and kings 10', () => {
    expect(totalPoints(makeDeck())).toBe(200);
    expect([pointsOf(sc('5h')[0]), pointsOf(sc('Th')[0]), pointsOf(sc('Kh')[0]), pointsOf(sc('Ah')[0]), pointsOf(sc('BJ')[0])]).toEqual([5, 10, 10, 0, 0]);
  });

  it('names cards', () => {
    expect(sc('As Th 3d 9c SJ BJ').map(cardName)).toEqual(['A♠', '10♥', '3♦', '9♣', 'SJ', 'BJ']);
  });
});

describe('which cards are trump', () => {
  it('counts jokers, level cards of any suit, and the trump suit', () => {
    const d = (text: string) => domainOf(sc(text)[0], T);
    expect([d('BJ'), d('SJ'), d('5s'), d('5d'), d('5h'), d('3h'), d('Ah')]).toEqual(Array(7).fill('trump'));
    expect([d('3s'), d('As'), d('Kd'), d('2c')]).toEqual(['spades', 'spades', 'diamonds', 'clubs']);
  });

  it('has no trump suit when none is named, only jokers and level cards', () => {
    expect(domainOf(sc('3h')[0], NO_TRUMP_5)).toBe('hearts');
    expect(domainOf(sc('5h')[0], NO_TRUMP_5)).toBe('trump');
    expect(domainOf(sc('SJ')[0], NO_TRUMP_5)).toBe('trump');
  });
});

describe('how strong cards are', () => {
  it('puts the trump group in order: big joker, small joker, the trump level, the other level cards, then the trump suit', () => {
    const order = ['BJ', 'SJ', '5h', '5s', 'Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '8h', '7h', '6h', '4h', '3h', '2h'];
    const positions = order.map((c) => pos(c));
    for (let i = 1; i < positions.length; i++) expect(positions[i], `${order[i]} below ${order[i - 1]}`).toBeLessThanOrEqual(positions[i - 1]);
    expect(pos('5s')).toBe(pos('5d')); // the level cards of other suits are equal
    expect(pos('5s')).toBe(pos('5c'));
    expect(pos('5h')).toBeGreaterThan(pos('5s'));
    expect(pos('5s')).toBeGreaterThan(pos('Ah'));
    expect(pos('Ah')).toBeGreaterThan(pos('Kh'));
    expect(pos('SJ')).toBeGreaterThan(pos('5h'));
    expect(pos('BJ')).toBeGreaterThan(pos('SJ'));
  });

  it('orders a plain suit from ace down, with the level rank left out', () => {
    const order = ['As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '8s', '7s', '6s', '4s', '3s', '2s'];
    const positions = order.map((c) => pos(c));
    for (let i = 1; i < positions.length; i++) expect(positions[i]).toBe(positions[i - 1] - 1); // no gaps at all
  });

  it('makes 4 and 6 neighbours when 5 is the level', () => {
    expect(pos('6s')).toBe(pos('4s') + 1);
    expect(pos('6s', { level: 7, suit: 'hearts' })).toBe(pos('5s', { level: 7, suit: 'hearts' }) + 1);
    expect(pos('8s', { level: 7, suit: 'hearts' })).toBe(pos('6s', { level: 7, suit: 'hearts' }) + 1); // 7 is skipped
  });

  it('takes the level card out of the ace-high rank when the level is the ace', () => {
    const ace = { level: 14, suit: 'hearts' } as const;
    expect(pos('Ks', ace)).toBe(12); // the king is the top of a plain suit, with the ace as trump
    expect(domainOf(sc('As')[0], ace)).toBe('trump');
  });

  it('puts every level card at the same strength when there is no trump suit, just below the jokers', () => {
    expect(positionOf(sc('5s')[0], NO_TRUMP_5)).toBe(positionOf(sc('5h')[0], NO_TRUMP_5));
    expect(positionOf(sc('SJ')[0], NO_TRUMP_5)).toBe(positionOf(sc('5s')[0], NO_TRUMP_5) + 1);
  });
});

describe('pairs', () => {
  it('are two cards of the same rank and suit', () => {
    expect(pairsIn(sc('7s 7s'), T)).toHaveLength(1);
    expect(pairsIn(sc('7s 7h'), T)).toHaveLength(0); // the same number in two suits is not a pair
    expect(pairsIn(sc('BJ BJ'), T)).toHaveLength(1);
    expect(pairsIn(sc('SJ BJ'), T)).toHaveLength(0); // a big joker and a small joker are not a pair
    expect(pairsIn(sc('5s 5d'), T)).toHaveLength(0); // level cards of different suits are not a pair
    expect(pairsIn(sc('5s 5s'), T)).toHaveLength(1);
  });

  it('finds every pair in a hand, strongest first', () => {
    const pairs = pairsIn(sc('7s 7s 9s 9s 9s 2s'), T);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].position).toBeGreaterThan(pairs[1].position);
  });
});

describe('tractors', () => {
  it('are pairs whose strengths follow each other', () => {
    expect(shape('7s 7s 8s 8s')).toBe('T2');
    expect(shape('Ks Ks As As')).toBe('T2');
    expect(shape('7s 7s 9s 9s')).toBe('P,P'); // the 8 is missing
    expect(shape('7s 7s 8s 8s 9s 9s')).toBe('T3');
  });

  it('count 4 and 6 as neighbours when 5 is the level', () => {
    expect(shape('4s 4s 6s 6s')).toBe('T2');
    expect(shape('3s 3s 6s 6s')).toBe('P,P');
  });

  it('can run through the trump group: jokers, the level cards, then the trump suit', () => {
    expect(shape('BJ BJ SJ SJ')).toBe('T2');
    expect(shape('SJ SJ 5h 5h')).toBe('T2');
    expect(shape('5h 5h 5s 5s')).toBe('T2'); // trump level, then a level card of another suit
    expect(shape('5s 5s Ah Ah')).toBe('T2'); // a level card of another suit, then the trump ace
    expect(shape('Kh Kh Ah Ah')).toBe('T2');
    expect(shape('BJ BJ 5h 5h')).toBe('P,P'); // the small joker pair is missing
  });

  it('do not join the level cards of two different suits, which are equal', () => {
    expect(shape('5s 5s 5d 5d')).toBe('P,P');
  });

  it('can be of three pairs or more, and the longest comes first', () => {
    expect(shape('Qs Qs Js Js Ts Ts')).toBe('T3');
    expect(shape('Qs Qs Js Js Ts Ts 9s 9s')).toBe('T4');
    expect(shape('Qs Qs Js Js Ts Ts 7s 7s')).toBe('P,T3');
  });
});

describe('what a lead is made of', () => {
  it('is a single, a pair or a tractor, or a throw of several pieces', () => {
    expect(analyze(sc('As'), T).combos.map((c) => c.kind)).toEqual(['single']);
    expect(analyze(sc('As As'), T).combos.map((c) => c.kind)).toEqual(['pair']);
    expect(analyze(sc('Ks Ks As As'), T).combos.map((c) => c.kind)).toEqual(['tractor']);
    expect(isThrow(analyze(sc('As Ks Ks'), T))).toBe(true);
    expect(isThrow(analyze(sc('As As'), T))).toBe(false);
  });

  it('must come from one suit, or the trumps together', () => {
    expect(analyze(sc('As Kh'), T).domain).toBeNull();
    expect(analyze(sc('As 5d'), T).domain).toBeNull(); // a level card is trump, an ace of spades is not
    expect(analyze(sc('Ah 5d SJ'), T).domain).toBe('trump');
    expect(analyze(sc('As Ks'), T).domain).toBe('spades');
  });
});

describe('throws', () => {
  const combosOf = (text: string) => analyze(sc(text), T).combos;

  it('stand when nobody else can beat any piece', () => {
    const check = checkThrow(combosOf('As Ks Ks'), [sc('Qs Js 3s 3d'), sc('2s 9h'), sc('Ah Ah 4c')], T);
    expect(check).toEqual({ ok: true });
  });

  it('fail when someone holds a higher single than a single piece, and the weakest piece is played instead', () => {
    const throwing = combosOf('Ks 9s');
    const check = checkThrow(throwing, [sc('As 2d'), sc('3c 4c'), sc('Qd Jd')], T);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.forced.cards.map(cardName)).toEqual(['9♠']);
  });

  it('fail when someone holds a higher pair than a pair piece', () => {
    const check = checkThrow(combosOf('As Ks Ks'), [sc('3c 4c'), sc('As As 2d'), sc('Qd Jd')], T);
    // The A-A pair beats the K-K pair. (A single ace of spades is not beaten, since only one ace is held beyond the lead.)
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.forced.cards.map(cardName)).toEqual(['K♠', 'K♠']);
  });

  it('are not beaten by trumps, because a trump cannot beat a throw by following suit', () => {
    const check = checkThrow(combosOf('As Ks Ks'), [sc('Ah Ah 3h 3h'), sc('2d 3d'), sc('BJ SJ')], T);
    expect(check).toEqual({ ok: true });
  });

  it('are not beaten by a higher card that is not part of a pair when the piece is a pair', () => {
    const check = checkThrow(combosOf('Ks Ks Qs'), [sc('As 3d'), sc('4d 4c'), sc('Js Ts')], T);
    // Nobody holds a pair of spades, so the king pair stands; and nobody holds a spade above a queen... except the ace.
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.forced.cards.map(cardName)).toEqual(['Q♠']);
  });

  it('only need a tractor to be beaten by a higher tractor of the same length', () => {
    const throwing = combosOf('Js Js Ts Ts As'); // a tractor and the top single
    // K-K and 9-9 are two pairs but not a tractor, so nothing beats the tractor, and nothing beats the ace.
    expect(checkThrow(throwing, [sc('Ks Ks 9s 9s'), sc('3c 4c'), sc('2d 3d')], T).ok).toBe(true);
    // K-K-Q-Q is a higher tractor than J-J-10-10.
    const beaten = checkThrow(throwing, [sc('Ks Ks Qs Qs'), sc('3c 4c'), sc('2d 3d')], T);
    expect(beaten.ok).toBe(false);
    if (!beaten.ok) expect(beaten.forced.kind).toBe('tractor'); // the weakest piece is the tractor, not the ace
  });

  it('a single card or single piece is never a throw', () => {
    expect(checkThrow(combosOf('As'), [sc('Ks Ks')], T)).toEqual({ ok: true });
  });
});

describe('following a lead', () => {
  const lead = (text: string) => analyze(sc(text), T);
  const hand = (text: string) => sc(text);

  it('needs the same number of cards', () => {
    const h = hand('3s 4s 7d');
    expect(checkFollow(h, pick(h, '3s 4s'), lead('As'), T)).toMatch(/exactly 1 card/);
    expect(checkFollow(h, pick(h, '3s'), lead('As'), T)).toBeNull();
  });

  it('must be cards you hold, each only once', () => {
    const h = hand('3s 4s');
    expect(checkFollow(h, sc('9s'), lead('As'), T)).toMatch(/do not hold/);
    expect(checkFollow(h, [h[0], h[0]], lead('As As'), T)).toMatch(/twice/);
  });

  describe('a single', () => {
    it('must follow suit if you can', () => {
      const h = hand('3s 4d 9c');
      expect(checkFollow(h, pick(h, '3s'), lead('As'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '4d'), lead('As'), T)).toMatch(/all your cards of the led suit/);
    });

    it('can be anything if you have none of the suit, including trump', () => {
      const h = hand('4d 9c Ah');
      for (const card of ['4d', '9c', 'Ah']) expect(checkFollow(h, pick(h, card), lead('As'), T)).toBeNull();
    });

    it('treats a trump lead as its own suit, which includes the level cards', () => {
      const h = hand('5s 3d 9c');
      expect(checkFollow(h, pick(h, '5s'), lead('Ah'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '3d'), lead('Ah'), T)).toMatch(/all your cards of the led suit/); // the 5 of spades is trump, so it must be played
    });

    it('does not count a level card as one of its suit when a suit is led', () => {
      const h = hand('5s 3d 9c');
      expect(checkFollow(h, pick(h, '3d'), lead('As'), T)).toBeNull(); // the 5 of spades is trump, so no spade is held
    });
  });

  describe('a pair', () => {
    it('must be followed with a pair if you have one', () => {
      const h = hand('3s 3s 4s 9s');
      expect(checkFollow(h, pick(h, '3s 3s'), lead('As As'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '4s 9s'), lead('As As'), T)).toMatch(/pairs/);
    });

    it('can be followed with any two cards of the suit if you have no pair', () => {
      const h = hand('3s 4s 9s 2d');
      expect(checkFollow(h, pick(h, '3s 9s'), lead('As As'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '3s 2d'), lead('As As'), T)).toMatch(/follow/);
    });

    it('needs your only card of the suit, then anything else', () => {
      const h = hand('3s 4d 9c');
      expect(checkFollow(h, pick(h, '3s 4d'), lead('As As'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '4d 9c'), lead('As As'), T)).toMatch(/all your cards/);
    });

    it('can be anything with none of the suit', () => {
      const h = hand('4d 9c 2h');
      expect(checkFollow(h, pick(h, '4d 9c'), lead('As As'), T)).toBeNull();
    });

    it('a pair of a different suit is not a pair of the same suit', () => {
      const h = hand('3s 3d 9s 2s');
      // Holds no spade pair, so any two spades do, and 3s 3d is not allowed (the 3 of diamonds is not a spade).
      expect(checkFollow(h, pick(h, '3s 9s'), lead('As As'), T)).toBeNull();
      expect(checkFollow(h, pick(h, '3s 3d'), lead('As As'), T)).toMatch(/follow/);
    });
  });

  describe('a tractor', () => {
    const tractor = lead('Ks Ks As As');

    it('must be followed with a tractor of the same length if you have one', () => {
      const h = hand('7s 7s 8s 8s 3s 3s 2s');
      expect(checkFollow(h, pick(h, '7s 7s 8s 8s'), tractor, T)).toBeNull();
      expect(checkFollow(h, pick(h, '7s 7s 3s 3s'), tractor, T)).toMatch(/tractor/);
    });

    it('must be followed with as many pairs as you can if you have no tractor', () => {
      const h = hand('7s 7s 9s 9s 3s 2s 4s');
      expect(checkFollow(h, pick(h, '7s 7s 9s 9s'), tractor, T)).toBeNull();
      expect(checkFollow(h, pick(h, '7s 7s 3s 2s'), tractor, T)).toMatch(/pairs/);
    });

    it('can use one pair and singles when you have only one pair', () => {
      const h = hand('7s 7s 3s 2s 4s 9d');
      expect(checkFollow(h, pick(h, '7s 7s 3s 2s'), tractor, T)).toBeNull();
      expect(checkFollow(h, pick(h, '3s 2s 4s 7s'), tractor, T)).toMatch(/pairs/);
    });

    it('can be any four cards of the suit with no pairs', () => {
      const h = hand('9s 7s 3s 2s 4s');
      expect(checkFollow(h, pick(h, '9s 7s 3s 2s'), tractor, T)).toBeNull();
    });

    it('needs every card of the suit when you hold fewer than the lead', () => {
      const h = hand('9s 7s 4d 3d 2c');
      expect(checkFollow(h, pick(h, '9s 7s 4d 3d'), tractor, T)).toBeNull();
      expect(checkFollow(h, pick(h, '9s 4d 3d 2c'), tractor, T)).toMatch(/all your cards/);
    });

    it('follows a tractor in trump with trump cards', () => {
      const h = hand('Ah Ah Kh Kh 3s 4d');
      expect(checkFollow(h, pick(h, 'Ah Ah Kh Kh'), lead('BJ BJ SJ SJ'), T)).toBeNull();
      expect(checkFollow(h, pick(h, 'Ah Ah 3s 4d'), lead('BJ BJ SJ SJ'), T)).toMatch(/all your cards of the led suit/); // all four trumps must go
    });
  });

  describe('a throw', () => {
    it('must be followed with the same pieces as far as your hand allows', () => {
      const throwing = lead('As Ks Ks'); // a pair and a single
      const h = hand('7s 7s 3s 2s 9d');
      expect(checkFollow(h, pick(h, '7s 7s 3s'), throwing, T)).toBeNull();
      expect(checkFollow(h, pick(h, '7s 3s 2s'), throwing, T)).toMatch(/pairs/);
    });
  });
});

describe('who wins a trick', () => {
  it('goes to the highest card of the suit led', () => {
    expect(trickWinner([play(0, 'Ks'), play(1, 'As'), play(2, '3s'), play(3, 'Qs')], T)).toBe(1);
  });

  it('is not won by a card of another suit', () => {
    expect(trickWinner([play(0, '3s'), play(1, 'Ad'), play(2, 'Kc'), play(3, '2s')], T)).toBe(0);
  });

  it('goes to the first player when the cards are equal', () => {
    expect(trickWinner([play(2, 'As'), play(3, 'As'), play(0, 'Ks'), play(1, 'Qs')], T)).toBe(2);
  });

  it('is won by a trump on a suit that was led', () => {
    expect(trickWinner([play(0, 'As'), play(1, '3h'), play(2, 'Ks'), play(3, 'Qs')], T)).toBe(1);
  });

  it('is won by a level card, which is trump even in a plain suit', () => {
    expect(trickWinner([play(0, 'As'), play(1, '5d'), play(2, 'Ks'), play(3, 'Qs')], T)).toBe(1);
  });

  it('goes to the higher trump when several are played', () => {
    expect(trickWinner([play(0, 'As'), play(1, '3h'), play(2, 'Kh'), play(3, '5s')], T)).toBe(3);
    expect(trickWinner([play(0, 'As'), play(1, '3h'), play(2, 'Kh'), play(3, 'SJ')], T)).toBe(3);
  });

  it('ranks the trump level above the level cards of other suits, and the jokers above both', () => {
    expect(trickWinner([play(0, '5s'), play(1, '5h'), play(2, '5d'), play(3, '5c')], T)).toBe(1);
    expect(trickWinner([play(0, '5h'), play(1, 'SJ'), play(2, 'BJ'), play(3, '5s')], T)).toBe(2);
  });

  it('keeps a trump lead for the highest trump, and a plain card cannot win it', () => {
    expect(trickWinner([play(0, 'Kh'), play(1, 'As'), play(2, 'Ah'), play(3, '2d')], T)).toBe(2);
  });

  it('is not won by two single trumps against a pair', () => {
    // The lead is a pair of spades. Playing two single trumps is not a pair, so it cannot win.
    expect(trickWinner([play(0, 'Ks Ks'), play(1, '3h 4h'), play(2, 'As Qs'), play(3, '3d 2d')], T)).toBe(0);
  });

  it('is won by a pair of trumps against a pair that was led', () => {
    expect(trickWinner([play(0, 'As As'), play(1, '3h 3h'), play(2, 'Ks Ks'), play(3, '3d 2d')], T)).toBe(1);
  });

  it('is won by the higher pair of trumps when two players ruff', () => {
    expect(trickWinner([play(0, 'As As'), play(1, '3h 3h'), play(2, '9h 9h'), play(3, '3d 2d')], T)).toBe(2);
  });

  it('is not won by a pair of the led suit that is not a pair (two different cards)', () => {
    expect(trickWinner([play(0, '7s 7s'), play(1, 'As Ks'), play(2, '3d 2d'), play(3, '8s 8s')], T)).toBe(3);
  });

  it('is won by a tractor of trumps against a tractor that was led, and not by a lone pair of trumps', () => {
    // 3-4 of trump is a tractor, and 6-7 of trump (the 5 is the level) is a higher one.
    expect(trickWinner([play(0, 'Ks Ks As As'), play(1, '3h 3h 4h 4h'), play(2, '6h 6h 7h 7h'), play(3, '2d 3d 4d 6d')], T)).toBe(2);
    // Two separate pairs of trump are not a tractor, so they cannot win.
    expect(trickWinner([play(0, 'Ks Ks As As'), play(1, '3h 3h 9h 9h'), play(2, '2d 3d 4d 6d'), play(3, '2c 3c 4c 6c')], T)).toBe(0);
  });

  it('is won by the higher tractor in the suit that was led', () => {
    expect(trickWinner([play(0, '7s 7s 8s 8s'), play(1, 'Js Js Qs Qs'), play(2, '3s 3s 4s 4s'), play(3, '9s 9s Ts Ts')], T)).toBe(1);
  });

  it('can be won against a throw only by a play of the same shape', () => {
    const lead = play(0, 'As Ks Ks'); // a single and a pair
    expect(trickWinner([lead, play(1, '3h 3h 4h'), play(2, '2d 3d 4d'), play(3, '2c 3c 4c')], T)).toBe(1); // pair and single of trump
    expect(trickWinner([lead, play(1, '3h 4h 6h'), play(2, '2d 3d 4d'), play(3, '2c 3c 4c')], T)).toBe(0); // three single trumps: wrong shape
  });

  it('is won by the highest piece of a throw when nobody ruffs', () => {
    const lead = play(0, '9s 8s 8s');
    expect(trickWinner([lead, play(1, 'As Ks Ks'), play(2, '3d 2d 4d'), play(3, '2c 3c 4c')], T)).toBe(1);
  });
});

describe('sorting a hand', () => {
  it('lists the trumps strongest first and the plain suits strongest first', () => {
    const sorted = sortHand(sc('3s As 5d BJ 2h Kd SJ 5h 4c'), T);
    const names = sorted.map(cardName);
    expect(names.slice(0, 5)).toEqual(['BJ', 'SJ', '5♥', '5♦', '2♥']);
    expect(names.slice(5)).toEqual(['A♠', '3♠', '4♣', 'K♦']);
  });
});
