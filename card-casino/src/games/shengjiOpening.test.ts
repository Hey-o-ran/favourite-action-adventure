import { describe, expect, it } from 'vitest';
import { makeDeck, type SCard } from './shengjiCards';
import { autoOpening, botDeclaration, buryKitty, dealOne, declare, declarerCards, startOpening, TOTAL_DEALT, type Opening } from './shengjiOpening';
import type { Standing } from './shengjiScoring';
import { sc } from './shengjiTestUtils';

function seeded(seed: number) {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const shuffled = (random: () => number): SCard[] => {
  const a = makeDeck();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const STANDING: Standing = { levels: [5, 8], declarer: 0 };
const dealtAll = (o: Opening) => {
  while (o.phase === 'dealing') o = dealOne(o);
  return o;
};
/** An opening part way through the deal with these hands, for testing declarations. */
const withHands = (hands: SCard[][], over: Partial<Opening> = {}): Opening => ({ ...startOpening(shuffled(seeded(1)), STANDING), hands, ...over });

describe('the deal', () => {
  it('deals one card at a time, and ends with 25 each and the kitty set aside', () => {
    let o = startOpening(shuffled(seeded(2)), STANDING);
    o = dealOne(o);
    expect(o.hands.flat()).toHaveLength(1);
    o = dealtAll(o);
    expect(o.dealt).toBe(TOTAL_DEALT);
    expect(o.hands.map((h) => h.length)).toEqual([25, 25, 25, 25]);
    expect(o.kitty).toHaveLength(8);
    expect(o.phase).toBe('kitty');
    expect(o.trump).not.toBeNull();
  });

  it('names the trump from the kitty when nobody declares', () => {
    // No bot can declare if no level card is dealt, so use a deck where the level 5 only appears in the kitty.
    const deck = makeDeck().filter((c) => c.suit === 'joker' || c.rank !== 5);
    const fives = makeDeck().filter((c) => c.rank === 5 && c.suit !== 'joker');
    const full = [...deck.slice(0, 100), ...fives.slice(0, 8)];
    const o = dealtAll(startOpening(full, STANDING));
    expect(o.declared).toBeNull();
    expect(o.trump!.suit).toBe(fives[0].suit);
    expect(o.log).toMatch(/kitty names the trump/i);
  });
});

describe('declaring', () => {
  it('lets a player show a level card, and shows the trump suit it names', () => {
    const o = withHands([sc('5s 9d'), [], [], []]);
    const out = declare(o, 0, sc('5s').slice(0, 0).concat(o.hands[0].slice(0, 1)));
    expect(out.ok && out.opening.declared?.declaration).toEqual({ strength: 1, suit: 'spades' });
  });

  it('refuses a card that is not a level card, or not held', () => {
    const o = withHands([sc('9s 5h'), [], [], []]);
    expect(declare(o, 0, [o.hands[0][0]]).ok).toBe(false);
    expect(declare(o, 0, sc('5d'))).toEqual({ ok: false, error: 'Those cards are not in the hand' });
  });

  it('can only be overruled by something stronger', () => {
    const hands = [sc('5s 5s'), sc('5h'), sc('5h 5h'), []];
    let o = withHands(hands);
    o = (declare(o, 1, hands[1]) as { opening: Opening }).opening;
    const single = declare(o, 0, [hands[0][0]]);
    expect(single.ok).toBe(false);
    const pair = declare(o, 0, hands[0]);
    expect(pair.ok && pair.opening.declared?.seat).toBe(0);
  });

  it('is not allowed once the deal is over', () => {
    const o = dealtAll(startOpening(shuffled(seeded(3)), STANDING));
    expect(declare(o, 0, [o.hands[0][0]])).toEqual({ ok: false, error: 'The deal is over' });
  });
});

describe('the bots declaring', () => {
  it('declare a level card when nobody has, in the suit they hold most of', () => {
    const o = withHands([[], sc('5s 5h 9h 8h 4h'), [], []]);
    expect(botDeclaration(o, 1)?.map((c) => c.suit)).toEqual(['hearts']);
  });

  it('declare a pair to overrule a single, but never overrule a partner', () => {
    const single = withHands([[], sc('5s 5s'), [], []], { declared: { seat: 0, declaration: { strength: 1, suit: 'hearts' }, cards: [] } });
    expect(botDeclaration(single, 1)).toHaveLength(2);
    const partners = withHands([sc('5h 5h'), [], sc('5s 5s'), []], { declared: { seat: 0, declaration: { strength: 1, suit: 'hearts' }, cards: [] } });
    expect(botDeclaration(partners, 2)).toBeNull();
  });

  it('declare nothing without a level card', () => {
    expect(botDeclaration(withHands([[], sc('9s Kh'), [], []]), 1)).toBeNull();
  });
});

describe('the kitty', () => {
  it('goes to the declarer, who puts back 8 cards and then leads', () => {
    const o = dealtAll(startOpening(shuffled(seeded(4)), STANDING));
    const all = declarerCards(o);
    expect(all).toHaveLength(33);
    const out = buryKitty(o, all.slice(0, 8));
    expect(out.ok && out.state.hands[0]).toHaveLength(25);
    expect(out.ok && out.state.kitty).toHaveLength(8);
    expect(out.ok && out.state.turn).toBe(0);
    expect(out.ok && out.state.trump).toEqual(o.trump);
  });

  it('refuses a burial of the wrong size', () => {
    const o = dealtAll(startOpening(shuffled(seeded(4)), STANDING));
    expect(buryKitty(o, declarerCards(o).slice(0, 7)).ok).toBe(false);
  });

  it('is played to the end whatever the deal, using every card once', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = autoOpening(shuffled(seeded(seed)), { levels: [2 + (seed % 13), 5], declarer: seed % 4 });
      expect(s.hands.map((h) => h.length)).toEqual([25, 25, 25, 25]);
      expect(new Set([...s.hands.flat(), ...s.kitty].map((c) => c.id)).size).toBe(108);
    }
  });
});
