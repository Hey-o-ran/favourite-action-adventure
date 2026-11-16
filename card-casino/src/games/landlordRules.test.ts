import { describe, expect, it } from 'vitest';
import {
  BIG_JOKER,
  DEFAULT_OPTIONS,
  SMALL_JOKER,
  bid,
  beats,
  classify,
  deal,
  forfeitRound,
  legalBids,
  legalPlays,
  multiplierOf,
  newLandlordDeck,
  pass,
  play,
  scoreRound,
  startBidding,
  startRound,
  type Combo,
  type Round,
  type RuleOptions,
} from './landlordRules';
import { cards, rankSignature, seeded } from './landlordTestUtils';

const on = (over: Partial<RuleOptions> = {}): RuleOptions => ({ ...DEFAULT_OPTIONS, ...over });
const kindOf = (text: string, options = on()) => classify(cards(text), options)?.kind ?? null;
const combo = (text: string, options = on()) => classify(cards(text), options) as Combo;

describe('the deck', () => {
  it('has 54 different cards, with both jokers', () => {
    const deck = newLandlordDeck();
    expect(deck).toHaveLength(54);
    expect(new Set(deck.map((c) => c.id)).size).toBe(54);
    expect(deck.filter((c) => c.rank === SMALL_JOKER)).toHaveLength(1);
    expect(deck.filter((c) => c.rank === BIG_JOKER)).toHaveLength(1);
    for (let rank = 3; rank <= 15; rank++) expect(deck.filter((c) => c.rank === rank)).toHaveLength(4);
  });

  it('deals 17 cards to each seat and keeps 3 for the landlord, highest first', () => {
    const { hands, bottom } = deal(newLandlordDeck());
    expect(hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(bottom).toHaveLength(3);
    expect(new Set([...hands.flat(), ...bottom].map((c) => c.id)).size).toBe(54);
    for (const hand of hands) expect(hand.map((c) => c.rank)).toEqual([...hand.map((c) => c.rank)].sort((a, b) => b - a));
  });
});

describe('recognising a play', () => {
  it('knows singles, pairs and triples', () => {
    expect(kindOf('5s')).toBe('single');
    expect(kindOf('5s 5h')).toBe('pair');
    expect(kindOf('5s 5h 5d')).toBe('triple');
  });

  it('knows a triple with one card or with a pair', () => {
    expect(kindOf('5s 5h 5d 9c')).toBe('tripleSingle');
    expect(kindOf('5s 5h 5d 9c 9s')).toBe('triplePair');
    expect(kindOf('5s 5h 5d x')).toBe('tripleSingle'); // a joker can be the extra card
  });

  it('knows straights of five or more, with the ace high and never a 2 or a joker', () => {
    expect(kindOf('3s 4h 5d 6c 7s')).toBe('straight');
    expect(kindOf('3s 4h 5d 6c 7s 8h 9d Tc Js Qh Kd As')).toBe('straight'); // 3 up to the ace: 12 cards
    expect(kindOf('Ts Jh Qd Kc As')).toBe('straight');
    expect(kindOf('3s 4h 5d 6c')).toBe(null); // only four
    expect(kindOf('Qs Kh Ad 2c 3s')).toBe(null); // a 2 cannot be in a straight
    expect(kindOf('Ks Ah 2d 3c 4s')).toBe(null); // and the ace does not wrap round
    expect(kindOf('Ts Jh Qd Kc x')).toBe(null); // nor a joker
    expect(kindOf('3s 4h 5d 6c 8s')).toBe(null); // a gap
  });

  it('knows runs of pairs (three or more)', () => {
    expect(kindOf('3s 3h 4s 4h 5s 5h')).toBe('pairRun');
    expect(kindOf('3s 3h 4s 4h')).toBe(null); // two pairs are not a run
    expect(kindOf('Qs Qh Ks Kh As Ah')).toBe('pairRun');
    expect(kindOf('3s 3h 4s 4h 6s 6h')).toBe(null);
  });

  it('knows planes: runs of two or more triples, bare or with one card or one pair for each', () => {
    expect(kindOf('3s 3h 3d 4s 4h 4d')).toBe('plane');
    expect(kindOf('3s 3h 3d 4s 4h 4d 5s 6h')).toBe('planeSingles');
    expect(kindOf('3s 3h 3d 4s 4h 4d 9s 9h Jh Jd')).toBe('planePairs');
    expect(kindOf('3s 3h 3d 4s 4h 4d 5s 5h 5d')).toBe('plane'); // three triples
    expect(kindOf('3s 3h 3d 4s 4h 4d 5s 5h 5d 6s 7s 8s')).toBe('planeSingles'); // three triples and three cards
    expect(kindOf('3s 3h 3d 5s 5h 5d')).toBe(null); // not in a row
    expect(kindOf('As Ah Ad 2s 2h 2d')).toBe(null); // the 2s are not part of a run
  });

  it('lets a plane carry a pair as its two single cards', () => {
    expect(kindOf('3s 3h 3d 4s 4h 4d 9s 9h')).toBe('planeSingles');
  });

  it('knows four with two cards, or with two pairs', () => {
    expect(kindOf('5s 5h 5d 5c 8s 9h')).toBe('fourSingles');
    expect(kindOf('5s 5h 5d 5c 8s 8h')).toBe('fourSingles'); // two cards that happen to be a pair
    expect(kindOf('5s 5h 5d 5c 8s 8h 9s 9h')).toBe('fourPairs');
    expect(kindOf('5s 5h 5d 5c 8s')).toBe(null);
  });

  it('knows bombs and the rocket', () => {
    expect(kindOf('5s 5h 5d 5c')).toBe('bomb');
    expect(kindOf('x X')).toBe('rocket');
    expect(kindOf('x')).toBe('single');
    expect(kindOf('X')).toBe('single');
    expect(kindOf('2s 2h 2d 2c')).toBe('bomb');
  });

  it('knows a straight flush only when that option is on', () => {
    expect(kindOf('3s 4s 5s 6s 7s', on({ straightFlush: true }))).toBe('straightFlush');
    expect(kindOf('3s 4s 5s 6s 7s', on({ straightFlush: false }))).toBe('straight');
    expect(kindOf('3s 4s 5s 6s 7h', on({ straightFlush: true }))).toBe('straight'); // not all one suit
    expect(kindOf('9d Td Jd Qd Kd Ad', on({ straightFlush: true }))).toBe('straightFlush'); // six long
  });

  it('refuses a plane, four-with-two or run of pairs when its option is off', () => {
    expect(kindOf('3s 3h 3d 4s 4h 4d', on({ planes: false }))).toBe(null);
    expect(kindOf('3s 3h 3d 4s 4h 4d 5s 6h', on({ planes: false }))).toBe(null);
    expect(kindOf('5s 5h 5d 5c 8s 9h', on({ fourWithTwo: false }))).toBe(null);
    expect(kindOf('5s 5h 5d 5c 8s 8h 9s 9h', on({ fourWithTwo: false }))).toBe(null);
    expect(kindOf('3s 3h 4s 4h 5s 5h', on({ pairRuns: false }))).toBe(null);
  });

  it('keeps the plain plays when a switch is off', () => {
    const off = on({ planes: false, fourWithTwo: false, pairRuns: false });
    expect(kindOf('5s 5h 5d 5c', off)).toBe('bomb');
    expect(kindOf('5s 5h 5d 9c', off)).toBe('tripleSingle');
    expect(kindOf('3s 4h 5d 6c 7s', off)).toBe('straight');
  });

  it('says nothing is a play for nothing or for a jumble', () => {
    expect(classify([], on())).toBe(null);
    expect(kindOf('3s 5h 9d')).toBe(null);
    expect(kindOf('3s 3h 5d')).toBe(null);
  });

  it('measures a play by its main rank', () => {
    expect(combo('9s').rank).toBe(9);
    expect(combo('5s 5h 5d 9c 9s').rank).toBe(5); // the triple, not the pair
    expect(combo('3s 4h 5d 6c 7s').rank).toBe(7); // the top of the straight
    expect(combo('3s 3h 3d 4s 4h 4d 9s 6h').rank).toBe(4); // the top triple
    expect(combo('5s 5h 5d 5c 8s 9h').rank).toBe(5);
  });
});

describe('which play beats which', () => {
  const higher = (a: string, b: string, options = on()) => beats(combo(a, options), combo(b, options));

  it('needs the same kind and size, and a higher rank', () => {
    expect(higher('9s', '8h')).toBe(true);
    expect(higher('8s', '9h')).toBe(false);
    expect(higher('9s', '9h')).toBe(false);
    expect(higher('9s 9h', '8s 8h')).toBe(true);
    expect(higher('9s', '8s 8h')).toBe(false);
    expect(higher('5s 5h 5d 9c', '4s 4h 4d 9c')).toBe(true);
    expect(higher('5s 5h 5d 9c', '4s 4h 4d 9c 9s')).toBe(false); // a single and a pair as the extra do not mix
  });

  it('ranks the 2 above the ace, and the jokers above the 2', () => {
    expect(higher('2s', 'Ah')).toBe(true);
    expect(higher('x', '2h')).toBe(true);
    expect(higher('X', 'x')).toBe(true);
  });

  it('compares straights of the same length only', () => {
    expect(higher('4s 5h 6d 7c 8s', '3s 4h 5d 6c 7s')).toBe(true);
    expect(higher('3s 4h 5d 6c 7s 8h', '4s 5h 6d 7c 8s')).toBe(false);
  });

  it('lets a bomb beat anything but a bigger bomb, and a higher bomb beat a lower one', () => {
    expect(higher('3s 3h 3d 3c', '2s')).toBe(true);
    expect(higher('3s 3h 3d 3c', 'Ks Kh Kd 9c 9s')).toBe(true);
    expect(higher('6s 6h 6d 6c', '5s 5h 5d 5c')).toBe(true);
    expect(higher('5s 5h 5d 5c', '6s 6h 6d 6c')).toBe(false);
  });

  it('lets the rocket beat everything', () => {
    expect(higher('x X', '2s 2h 2d 2c')).toBe(true);
    expect(higher('2s 2h 2d 2c', 'x X')).toBe(false);
  });

  it('puts a straight flush above a bomb and below the rocket', () => {
    const sf = on({ straightFlush: true });
    expect(higher('3s 4s 5s 6s 7s', '2s 2h 2d 2c', sf)).toBe(true);
    expect(higher('2s 2h 2d 2c', '3s 4s 5s 6s 7s', sf)).toBe(false);
    expect(higher('x X', '3s 4s 5s 6s 7s', sf)).toBe(true);
    expect(higher('3s 4s 5s 6s 7s', 'x X', sf)).toBe(false);
  });

  it('compares straight flushes of the same length by rank only', () => {
    const sf = on({ straightFlush: true });
    expect(higher('4h 5h 6h 7h 8h', '3s 4s 5s 6s 7s', sf)).toBe(true);
    expect(higher('3s 4s 5s 6s 7s 8s', '4h 5h 6h 7h 8h', sf)).toBe(false);
  });

  it('lets a straight flush beat an ordinary straight, but not the other way round', () => {
    const sf = on({ straightFlush: true });
    expect(higher('3s 4s 5s 6s 7s', '4s 5h 6d 7c 8s', sf)).toBe(true);
    expect(higher('4s 5h 6d 7c 8s', '3s 4s 5s 6s 7s', sf)).toBe(false);
  });
});

describe('listing the plays a hand can make', () => {
  it('lists every single, pair, triple and so on when leading', () => {
    const hand = cards('5s 5h 5d 9c 9s');
    const plays = legalPlays(hand, null, on()).map(rankSignature).sort();
    expect(plays).toEqual(
      ['5', '5,5', '5,5,5', '5,5,5,9,9', '5,5,5,9', '9', '9,9'].sort(),
    );
  });

  it('lists only what beats the last play, and the bombs and rocket', () => {
    const hand = cards('3s 6h 9d 9c Ks 5s 5h 5d 5c x X');
    const plays = legalPlays(hand, combo('8s'), on()).map(rankSignature);
    expect(plays.filter((p) => !p.includes(',')).sort()).toEqual(['13', '16', '17', '9']);
    expect(plays).toContain('5,5,5,5'); // a bomb
    expect(plays).toContain('16,17'); // the rocket
    expect(plays).not.toContain('3');
    expect(plays).not.toContain('6');
  });

  it('can only answer a bomb with a bigger bomb, a straight flush or the rocket', () => {
    const hand = cards('3s 3h 3d 3c 9s 9h 9d 9c Ks x X');
    const plays = legalPlays(hand, combo('6s 6h 6d 6c'), on()).map(rankSignature);
    expect(plays.sort()).toEqual(['9,9,9,9', '16,17'].sort());
  });

  it('offers a straight flush, when allowed, to beat a bomb', () => {
    const hand = cards('3s 4s 5s 6s 7s');
    expect(legalPlays(hand, combo('2s 2h 2d 2c'), on({ straightFlush: true }))).toHaveLength(1);
    expect(legalPlays(hand, combo('2s 2h 2d 2c'), on({ straightFlush: false }))).toHaveLength(0);
  });

  it('leaves out a plane, four-with-two or run of pairs when switched off', () => {
    const hand = cards('3s 3h 3d 4s 4h 4d 5s 5h 8s 8h 8d 8c');
    const withAll = legalPlays(hand, null, on()).map((p) => classify(p, on())!.kind);
    expect(withAll).toContain('plane');
    expect(withAll).toContain('fourSingles');
    const none = legalPlays(hand, null, on({ planes: false, fourWithTwo: false, pairRuns: false })).map((p) => classify(p, on())!.kind);
    for (const kind of ['plane', 'planeSingles', 'planePairs', 'fourSingles', 'fourPairs', 'pairRun']) expect(none).not.toContain(kind);
    expect(none).toContain('bomb');
  });

  it('only ever lists plays that really are legal, and finds every legal play', () => {
    const random = seeded(7);
    for (let round = 0; round < 120; round++) {
      const deck = [...newLandlordDeck()].sort(() => random() - 0.5);
      const hand = deck.slice(0, 9 + Math.floor(random() * 3)); // 9 to 11 cards, often with pairs, triples and runs
      const options = on({ straightFlush: random() > 0.5, planes: random() > 0.3, fourWithTwo: random() > 0.3, pairRuns: random() > 0.3 });

      const listed = new Set(legalPlays(hand, null, options).map(rankSignature));
      for (const p of legalPlays(hand, null, options)) {
        expect(classify(p, options), rankSignature(p)).not.toBeNull();
        expect(p.every((c) => hand.some((h) => h.id === c.id))).toBe(true);
        expect(new Set(p.map((c) => c.id)).size).toBe(p.length);
      }

      // Every subset of the hand that is a play must be among the listed plays (by its ranks).
      const found = new Set<string>();
      const n = hand.length;
      for (let mask = 1; mask < 1 << n; mask++) {
        const subset = hand.filter((_, i) => mask & (1 << i));
        if (subset.length > 12) continue;
        if (classify(subset, options)) found.add(rankSignature(subset));
      }
      expect([...found].filter((s) => !listed.has(s))).toEqual([]);
      expect([...listed].filter((s) => !found.has(s))).toEqual([]);
    }
  });
});

describe('bidding', () => {
  it('starts with the first seat, who may pass or bid 1, 2 or 3', () => {
    const state = startBidding(1);
    expect(state.turn).toBe(1);
    expect(legalBids(state)).toEqual([0, 1, 2, 3]);
  });

  it('only allows a higher bid than the last one, or a pass', () => {
    let state = startBidding(0);
    state = bid(state, 2);
    expect(state.turn).toBe(1);
    expect(legalBids(state)).toEqual([0, 3]);
    expect(bid(state, 1)).toBe(state); // not allowed, so nothing changes
  });

  it('ends at once on a bid of 3, and that player is the landlord', () => {
    let state = startBidding(0);
    state = bid(state, 1);
    state = bid(state, 3);
    expect(state.done).toBe(true);
    expect(state.landlord).toBe(1);
    expect(state.value).toBe(3);
  });

  it('gives the landlord to the highest bidder after all three have spoken', () => {
    let state = startBidding(2);
    state = bid(state, 1); // seat 2
    state = bid(state, 0); // seat 0
    expect(state.done).toBe(false);
    state = bid(state, 2); // seat 1
    expect(state.done).toBe(true);
    expect(state.landlord).toBe(1);
    expect(state.value).toBe(2);
  });

  it('asks for a new deal when everybody passes', () => {
    let state = startBidding(0);
    state = bid(bid(bid(state, 0), 0), 0);
    expect(state.done).toBe(true);
    expect(state.redeal).toBe(true);
    expect(state.landlord).toBeNull();
  });

  it('does nothing once bidding is over', () => {
    let state = startBidding(0);
    state = bid(state, 3);
    expect(bid(state, 0)).toBe(state);
  });
});

/** A round with hands written out, the landlord's 3 extra cards already in their hand. */
function roundOf(hands: [string, string, string], landlord = 0, bidValue = 1, options = on()): Round {
  return startRound(
    hands.map((h) => cards(h)),
    [],
    landlord,
    bidValue,
    options,
  );
}
const play$ = (round: Round, text: string) => play(round, cards(text, round.hands.flat()));

describe('playing a round', () => {
  it('starts with the landlord, who gets the bottom cards', () => {
    const deck = newLandlordDeck();
    const { hands, bottom } = deal(deck);
    const round = startRound(hands, bottom, 2, 2, on());
    expect(round.hands[2]).toHaveLength(20);
    expect(round.hands[0]).toHaveLength(17);
    expect(round.turn).toBe(2);
    expect(round.landlord).toBe(2);
    expect(round.last).toBeNull();
    expect(round.winner).toBeNull();
  });

  it('plays a legal lead, takes the cards from the hand and passes the turn on', () => {
    const round = roundOf(['3s 5h 7d', '4s 9h', '6s 8h']);
    const next = play$(round, '3s');
    expect(next.hands[0].map((c) => c.rank)).toEqual([7, 5]); // highest first
    expect(next.turn).toBe(1);
    expect(next.last?.seat).toBe(0);
  });

  it('ignores a play with cards the seat does not hold, or a jumble, or one that does not beat the last', () => {
    const round = roundOf(['3s 5h 7d', '4s 9h', '6s 8h']);
    expect(play(round, cards('9s'))).toBe(round); // not in the hand
    expect(play$(round, '3s 7d')).toBe(round); // not a play
    const led = play$(round, '7d');
    expect(play$(led, '4s')).toBe(led); // does not beat the 7
  });

  it('lets the next seat beat it, or pass', () => {
    let round = roundOf(['3s 5h 7d', '4s 9h', '6s 8h']);
    round = play$(round, '5h');
    round = play$(round, '9h');
    expect(round.last?.seat).toBe(1);
    expect(round.turn).toBe(2);
    const passed = pass(round);
    expect(passed.turn).toBe(0);
    expect(passed.passes).toBe(1);
  });

  it('does not let a seat pass when it is leading', () => {
    const round = roundOf(['3s 5h 7d', '4s 9h', '6s 8h']);
    expect(pass(round)).toBe(round);
  });

  it('gives the lead back to the last player after two passes', () => {
    let round = roundOf(['3s 5h 7d', '4s 9h', '6s 8h']);
    round = play$(round, '5h'); // seat 0
    round = pass(round); // seat 1
    round = pass(round); // seat 2
    expect(round.turn).toBe(0);
    expect(round.last).toBeNull();
    expect(round.passes).toBe(0);
    expect(pass(round)).toBe(round); // seat 0 is leading again
  });

  it('ends when a seat plays its last card, and nothing more can be played', () => {
    let round = roundOf(['3s', '4s 9h', '6s 8h']);
    round = play$(round, '3s');
    expect(round.winner).toBe(0);
    expect(play$(round, '4s')).toBe(round);
    expect(pass(round)).toBe(round);
  });
});

describe('the multiplier', () => {
  it('starts at the bid', () => {
    expect(multiplierOf(roundOf(['3s', '4s', '6s'], 0, 3))).toBe(3);
  });

  it('doubles for each bomb, rocket or straight flush played', () => {
    let round = roundOf(['3s 3h 3d 3c 9s', 'x X 5s', '4s 4h 4d 4c 8s'], 0, 2);
    round = play$(round, '3s 3h 3d 3c');
    expect(multiplierOf(round)).toBe(4);
    round = play$(round, 'x X');
    expect(multiplierOf(round)).toBe(8);
    const sf = roundOf(['3s 4s 5s 6s 7s 9h', '4h', '8c'], 0, 1, on({ straightFlush: true }));
    expect(multiplierOf(play$(sf, '3s 4s 5s 6s 7s'))).toBe(2);
  });

  it('does not double for a straight that is not all one suit, or when straight flush is off', () => {
    const mixed = roundOf(['3s 4s 5s 6s 7h 9h', '4h', '8c'], 0, 1, on({ straightFlush: true }));
    expect(multiplierOf(play$(mixed, '3s 4s 5s 6s 7h'))).toBe(1);
    const off = roundOf(['3s 4s 5s 6s 7s 9h', '4h', '8c'], 0, 1, on({ straightFlush: false }));
    expect(multiplierOf(play$(off, '3s 4s 5s 6s 7s'))).toBe(1);
  });

  it('doubles once more for a spring: the landlord wins before the peasants play at all', () => {
    let round = roundOf(['3s 4s', '9h 9d', '8h 8d'], 0, 2);
    round = play$(round, '3s');
    round = pass(round);
    round = pass(round);
    round = play$(round, '4s');
    expect(round.winner).toBe(0);
    expect(multiplierOf(round)).toBe(4); // bid 2, doubled for the spring
  });

  it('doubles for a reverse spring: the peasants win while the landlord has played only once', () => {
    let round = roundOf(['3s 5s 7s', '4s', '9h 9d'], 0, 1);
    round = play$(round, '3s'); // the landlord's only play
    round = play$(round, '4s'); // seat 1, a peasant, goes out
    expect(round.winner).toBe(1);
    expect(multiplierOf(round)).toBe(2);
  });

  it('is no spring when a peasant has played before the landlord goes out', () => {
    let round = roundOf(['3s 8s', '6h 9h 9d', '7d 7c'], 0, 1);
    round = play$(round, '3s');
    round = play$(round, '6h'); // a peasant plays
    round = pass(round);
    round = play$(round, '8s'); // the landlord goes out
    expect(round.winner).toBe(0);
    expect(multiplierOf(round)).toBe(1);
  });

  it('is no reverse spring when the landlord has played more than once', () => {
    let round = roundOf(['3s 5s 9s', '4s 6s 9h', '7d'], 0, 1);
    round = play$(round, '3s');
    round = play$(round, '4s');
    round = pass(round);
    round = play$(round, '5s'); // the landlord's second play
    round = play$(round, '6s');
    round = play$(round, '7d'); // a peasant goes out
    expect(round.winner).toBe(2);
    expect(multiplierOf(round)).toBe(1);
  });
});

describe('scoring a round', () => {
  const finished = (landlordWins: boolean, bidValue: number, doubled: number): Round => {
    // The multiplier is bid x 2^doubled, with no spring: a hand is built so that play gets there.
    const base = roundOf(['3s', '4s', '5s'], 0, bidValue);
    return { ...base, winner: landlordWins ? 0 : 1, doublings: doubled, plays: [2, 2, 2] } as Round;
  };

  it('pays a peasant who wins the bet times the multiplier, plus the bet back', () => {
    const r = finished(false, 2, 1); // M = 4
    expect(multiplierOf(r)).toBe(4);
    expect(scoreRound(r, 100, 1)).toEqual({ won: true, multiplier: 4, returned: 500, extraLoss: 0 });
    expect(scoreRound(r, 100, 2)).toEqual({ won: true, multiplier: 4, returned: 500, extraLoss: 0 }); // the other peasant
  });

  it('pays a landlord who wins twice that, plus the bet back', () => {
    expect(scoreRound(finished(true, 2, 1), 100, 0)).toEqual({ won: true, multiplier: 4, returned: 900, extraLoss: 0 });
  });

  it('takes the bet and a half of the multiplier from a peasant who loses', () => {
    expect(scoreRound(finished(true, 2, 1), 100, 1)).toEqual({ won: false, multiplier: 4, returned: 0, extraLoss: 200 });
  });

  it('takes the bet and a quarter of the multiplier from a landlord who loses', () => {
    expect(scoreRound(finished(false, 2, 1), 100, 0)).toEqual({ won: false, multiplier: 4, returned: 0, extraLoss: 100 });
  });

  it('rounds the extra loss down to a whole coin', () => {
    expect(scoreRound(finished(true, 1, 0), 25, 1)).toMatchObject({ extraLoss: 12 }); // 25 x 1 / 2
    expect(scoreRound(finished(false, 1, 0), 25, 0)).toMatchObject({ extraLoss: 6 }); // 25 x 1 / 4
  });

  it('has no limit on the multiplier', () => {
    const r = finished(false, 3, 10); // 3 x 1024
    expect(multiplierOf(r)).toBe(3072);
    expect(scoreRound(r, 10, 1).returned).toBe(10 + 10 * 3072);
  });

  it('refuses to score a round that is not over', () => {
    expect(() => scoreRound(roundOf(['3s 4s', '5s', '6s']), 100, 0)).toThrow();
  });
});

describe('giving up', () => {
  it('counts as a loss for that seat, at the multiplier so far, with no spring', () => {
    let round = roundOf(['3s 3h 3d 3c 9s', '5s 6s', '7s 8s'], 0, 2);
    round = play$(round, '3s 3h 3d 3c'); // a bomb: M = 4
    const gaveUp = forfeitRound(round, 1);
    expect(gaveUp.winner).not.toBeNull();
    expect(scoreRound(gaveUp, 100, 1)).toEqual({ won: false, multiplier: 4, returned: 0, extraLoss: 200 });
  });

  it('counts as a loss for the landlord too', () => {
    const gaveUp = forfeitRound(roundOf(['3s 9s', '5s', '7s'], 0, 1), 0);
    expect(scoreRound(gaveUp, 100, 0)).toEqual({ won: false, multiplier: 1, returned: 0, extraLoss: 25 });
  });

  it('does nothing once the round is over', () => {
    let round = roundOf(['3s', '4s 9h', '6s 8h']);
    round = play$(round, '3s');
    expect(forfeitRound(round, 1)).toBe(round);
  });
});
