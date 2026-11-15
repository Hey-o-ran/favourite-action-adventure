import { describe, expect, it } from 'vitest';
import { makeDeck, totalPoints } from './shengjiCards';
import {
  ATTACK_TARGET,
  HAND_SIZE,
  KITTY_SIZE,
  attackerScore,
  canDeclare,
  checkBury,
  deal,
  handLevel,
  kittyMultiplier,
  kittyPointsOf,
  levelLabel,
  nextHand,
  outcomeFor,
  partnerOf,
  payoutMultiple,
  readDeclaration,
  teamOf,
  trumpFromKitty,
  type Standing,
} from './shengjiScoring';
import { HEARTS_5, sc } from './shengjiTestUtils';

describe('sides', () => {
  it('puts seats 0 and 2 together, and 1 and 3 together', () => {
    expect([0, 1, 2, 3].map(teamOf)).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2, 3].map(partnerOf)).toEqual([2, 3, 0, 1]);
  });
});

describe('dealing', () => {
  const deck = makeDeck();

  it('gives each player 25 cards and leaves 8 for the kitty, using every card once', () => {
    const { hands, kitty } = deal(deck, 0);
    expect(hands.map((h) => h.length)).toEqual([HAND_SIZE, HAND_SIZE, HAND_SIZE, HAND_SIZE]);
    expect(kitty).toHaveLength(KITTY_SIZE);
    const ids = [...hands.flat(), ...kitty].map((c) => c.id);
    expect(new Set(ids).size).toBe(108);
  });

  it('deals one card at a time round the table from the first seat', () => {
    const { hands, dealOrder } = deal(deck, 2);
    expect(dealOrder).toHaveLength(100);
    expect(dealOrder.slice(0, 5).map((d) => d.seat)).toEqual([2, 3, 0, 1, 2]);
    expect(hands[2][0]).toBe(deck[0]);
    expect(hands[3][0]).toBe(deck[1]);
    expect(hands[2][1]).toBe(deck[4]);
  });

  it('keeps the last 8 cards of the deck as the kitty', () => {
    expect(deal(deck, 0).kitty).toEqual(deck.slice(100));
  });

  it('refuses a deck that is not 108 cards', () => {
    expect(() => deal(deck.slice(1), 0)).toThrow(/108/);
  });
});

describe('declaring trump', () => {
  it('shows a level card to name its suit', () => {
    expect(readDeclaration(sc('5h'), 5)).toEqual({ strength: 1, suit: 'hearts' });
    expect(readDeclaration(sc('5s'), 5)).toEqual({ strength: 1, suit: 'spades' });
  });

  it('does not count a card that is not the level, or a lone joker', () => {
    expect(readDeclaration(sc('6h'), 5)).toBeNull();
    expect(readDeclaration(sc('BJ'), 5)).toBeNull();
    expect(readDeclaration(sc('SJ'), 5)).toBeNull();
  });

  it('is stronger as a pair of the same level card', () => {
    expect(readDeclaration(sc('5h 5h'), 5)).toEqual({ strength: 2, suit: 'hearts' });
  });

  it('does not count a pair of level cards in different suits, or a pair that is not the level', () => {
    expect(readDeclaration(sc('5h 5s'), 5)).toBeNull();
    expect(readDeclaration(sc('6h 6h'), 5)).toBeNull();
  });

  it('can be a pair of jokers for no trump: small jokers, and big jokers which are stronger', () => {
    expect(readDeclaration(sc('SJ SJ'), 5)).toEqual({ strength: 3, suit: null });
    expect(readDeclaration(sc('BJ BJ'), 5)).toEqual({ strength: 4, suit: null });
    expect(readDeclaration(sc('SJ BJ'), 5)).toBeNull();
  });

  it('needs one card or a pair', () => {
    expect(readDeclaration([], 5)).toBeNull();
    expect(readDeclaration(sc('5h 5h 5h'), 5)).toBeNull();
  });

  it('can only be overruled by a stronger declaration', () => {
    const single = { strength: 1, suit: 'hearts' } as const;
    const pair = { strength: 2, suit: 'spades' } as const;
    const smalls = { strength: 3, suit: null } as const;
    const bigs = { strength: 4, suit: null } as const;
    expect(canDeclare(single, null)).toBe(true);
    expect(canDeclare(single, single)).toBe(false);
    expect(canDeclare({ strength: 1, suit: 'clubs' }, single)).toBe(false);
    expect(canDeclare(pair, single)).toBe(true);
    expect(canDeclare(single, pair)).toBe(false);
    expect(canDeclare(pair, pair)).toBe(false);
    expect(canDeclare(smalls, pair)).toBe(true);
    expect(canDeclare(bigs, smalls)).toBe(true);
    expect(canDeclare(smalls, bigs)).toBe(false);
  });
});

describe('when nobody declares', () => {
  it('lets the first level card in the kitty name the trump suit', () => {
    expect(trumpFromKitty(sc('As 5d Kc 5h 2s 3s 4s 9c'), 5)).toBe('diamonds');
  });

  it('falls back to the suit of the highest card when there is no level card', () => {
    expect(trumpFromKitty(sc('As Kd Kc 2h 2s 3s 4s 9c'), 5)).toBe('spades');
    expect(trumpFromKitty(sc('9s Kd 3c 2h 2s 3s 4s 9c'), 5)).toBe('diamonds');
  });

  it('plays with no trump suit if the highest card is a joker', () => {
    expect(trumpFromKitty(sc('As Kd BJ 2h 2s 3s 4s 9c'), 5)).toBeNull();
  });

  it('takes the first of equally high cards', () => {
    expect(trumpFromKitty(sc('Ks Kd 3c 2h 2s 3s 4s 9c'), 5)).toBe('spades');
  });
});

describe('the kitty', () => {
  const hand = sc('3s 4s 6s 7s 8s 9s Ts Js 3d 4d 6d 7d 8d 9d Td Jd 3c 4c 6c 7c 8c 9c Tc Jc 2c');
  const kitty = sc('As Ks Qs Ah Kh Qh Ad Kd');

  it('needs exactly 8 cards put back, from the 33 the declarer holds', () => {
    expect(checkBury(hand, kitty, [...hand.slice(0, 4), ...kitty.slice(0, 4)])).toBeNull();
    expect(checkBury(hand, kitty, hand.slice(0, 7))).toMatch(/exactly 8/);
    expect(checkBury(hand, kitty, hand.slice(0, 9))).toMatch(/exactly 8/);
  });

  it('refuses a card twice or a card that is not held', () => {
    expect(checkBury(hand, kitty, [...hand.slice(0, 7), hand[0]])).toMatch(/twice/);
    expect(checkBury(hand, kitty, [...hand.slice(0, 7), ...sc('9h')])).toMatch(/not yours/);
  });

  it('is worth its points to whoever wins the last trick, multiplied by what won it', () => {
    expect(kittyPointsOf(sc('5s Kd Ah 2c Th 9d 5c 3s'))).toBe(5 + 10 + 5 + 10);
    expect(kittyMultiplier(sc('As'), HEARTS_5)).toBe(2);
    expect(kittyMultiplier(sc('As As'), HEARTS_5)).toBe(4);
    expect(kittyMultiplier(sc('Ks Ks As As'), HEARTS_5)).toBe(8); // a tractor of two pairs
    expect(kittyMultiplier(sc('Qs Qs Js Js Ts Ts'), HEARTS_5)).toBe(12);
    expect(kittyMultiplier(sc('As Ks Ks'), HEARTS_5)).toBe(4); // a throw counts by its biggest piece
  });

  it('adds to the attackers only if they won the last trick', () => {
    expect(attackerScore({ trickPoints: 60, kittyPoints: 15, attackersWonLast: true, multiplier: 2 })).toBe(90);
    expect(attackerScore({ trickPoints: 60, kittyPoints: 15, attackersWonLast: true, multiplier: 8 })).toBe(180);
    expect(attackerScore({ trickPoints: 60, kittyPoints: 15, attackersWonLast: false, multiplier: 8 })).toBe(60);
  });

  it('has the 200 points of the whole deck between the kitty and the tricks', () => {
    expect(totalPoints(makeDeck())).toBe(200);
  });
});

describe('who wins a hand and how far they move up', () => {
  const at = (score: number) => outcomeFor(score);

  it('needs 80 for the attackers', () => {
    expect(ATTACK_TARGET).toBe(80);
    expect(at(75).winner).toBe('defenders');
    expect(at(80).winner).toBe('attackers');
  });

  it('gives the defenders 1 level for 40 to 75, 2 for under 40, and 3 for nothing at all', () => {
    expect([at(75), at(40)].map((o) => o.levels)).toEqual([1, 1]);
    expect([at(35), at(5)].map((o) => o.levels)).toEqual([2, 2]);
    expect(at(0)).toEqual({ winner: 'defenders', levels: 3 });
  });

  it('gives the attackers no level for 80 to 115, 1 for 120 to 155, 2 for 160 to 195 and 3 for 200 or more', () => {
    expect([at(80), at(115)].map((o) => o.levels)).toEqual([0, 0]);
    expect([at(120), at(155)].map((o) => o.levels)).toEqual([1, 1]);
    expect([at(160), at(195)].map((o) => o.levels)).toEqual([2, 2]);
    expect([at(200), at(240)].map((o) => o.levels)).toEqual([3, 3]);
  });

  it('pays 2x for a win of 0 or 1 level, 3x for 2 and 4x for 3', () => {
    expect([0, 1, 2, 3].map(payoutMultiple)).toEqual([2, 2, 3, 4]);
  });
});

describe('what happens after a hand', () => {
  const standing = (over: Partial<Standing> = {}): Standing => ({ levels: [2, 2], declarer: 0, ...over });

  it('moves the declaring side up and passes the deal to the declarer partner when the defenders hold', () => {
    const next = nextHand(standing(), { winner: 'defenders', levels: 2 });
    expect(next.levels).toEqual([4, 2]);
    expect(next.declarer).toBe(2);
    expect(next.gameWonBy).toBeNull();
  });

  it('moves the other side up and passes the deal to the next player when the attackers win', () => {
    const next = nextHand(standing({ declarer: 0 }), { winner: 'attackers', levels: 1 });
    expect(next.levels).toEqual([2, 3]);
    expect(next.declarer).toBe(1);
  });

  it('lets the attackers take over the deal without a level when they just reach 80', () => {
    const next = nextHand(standing({ levels: [5, 7], declarer: 1 }), { winner: 'attackers', levels: 0 });
    expect(next.levels).toEqual([5, 7]);
    expect(next.declarer).toBe(2);
  });

  it('works for a declarer on the other side too', () => {
    const next = nextHand(standing({ levels: [2, 9], declarer: 3 }), { winner: 'defenders', levels: 3 });
    expect(next.levels).toEqual([2, 12]);
    expect(next.declarer).toBe(1);
  });

  it('wraps the deal round the table', () => {
    expect(nextHand(standing({ declarer: 3 }), { winner: 'attackers', levels: 0 }).declarer).toBe(0);
    expect(nextHand(standing({ declarer: 2 }), { winner: 'defenders', levels: 1 }).declarer).toBe(0);
  });

  it('stops at ace, however many levels are won', () => {
    const next = nextHand(standing({ levels: [13, 2], declarer: 0 }), { winner: 'defenders', levels: 3 });
    expect(next.levels[0]).toBe(14);
    expect(next.gameWonBy).toBeNull(); // not yet: the game is only won by winning a hand while already at ace
  });

  it('is won by winning a hand as the declarers while already at ace', () => {
    const next = nextHand(standing({ levels: [14, 6], declarer: 2 }), { winner: 'defenders', levels: 1 });
    expect(next.gameWonBy).toBe(0);
  });

  it('is not won by the attackers, even if they are at ace: they must declare first', () => {
    const next = nextHand(standing({ levels: [3, 14], declarer: 0 }), { winner: 'attackers', levels: 2 });
    expect(next.gameWonBy).toBeNull();
    expect(next.levels).toEqual([3, 14]);
    expect(next.declarer).toBe(1);
  });

  it('is not won by the declarers at ace if the attackers beat them', () => {
    const next = nextHand(standing({ levels: [14, 6], declarer: 0 }), { winner: 'attackers', levels: 0 });
    expect(next.gameWonBy).toBeNull();
  });

  it('uses the level of the declaring side as the trump level', () => {
    expect(handLevel({ levels: [4, 9], declarer: 0 })).toBe(4);
    expect(handLevel({ levels: [4, 9], declarer: 1 })).toBe(9);
    expect(handLevel({ levels: [4, 9], declarer: 2 })).toBe(4);
    expect(handLevel({ levels: [4, 9], declarer: 3 })).toBe(9);
  });

  it('names a level', () => {
    expect([2, 10, 11, 13, 14].map(levelLabel)).toEqual(['2', '10', 'J', 'K', 'A']);
  });
});
