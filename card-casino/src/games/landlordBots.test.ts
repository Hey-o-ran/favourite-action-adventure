import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS,
  bid,
  classify,
  deal,
  legalBids,
  newLandlordDeck,
  pass,
  play,
  startBidding,
  startRound,
  type Round,
  type RuleOptions,
} from './landlordRules';
import { botBid, botPlay, turnsToEmpty } from './landlordBots';
import { cards, rankSignature, seeded } from './landlordTestUtils';

const options = (over: Partial<RuleOptions> = {}): RuleOptions => ({ ...DEFAULT_OPTIONS, ...over });

/** A round with hands written out, with `turn` already set and an optional play on the table. */
function table(
  hands: [string, string, string],
  opts: { landlord?: number; turn?: number; last?: { seat: number; text: string } } = {},
  rules = options(),
): Round {
  const base = startRound(hands.map((h) => cards(h)), [], opts.landlord ?? 0, 1, rules);
  const round: Round = { ...base, turn: opts.turn ?? opts.landlord ?? 0 };
  if (!opts.last) return round;
  const lastCards = cards(opts.last.text);
  return { ...round, last: { seat: opts.last.seat, cards: lastCards, combo: classify(lastCards, rules)! }, passes: 0 };
}
const move = (round: Round) => {
  const chosen = botPlay(round, round.turn);
  return chosen ? rankSignature(chosen) : 'pass';
};

const shuffled = (random: () => number) => [...newLandlordDeck()].sort(() => random() - 0.5);

describe('bidding', () => {
  it('bids 3 on a hand with the rocket, bombs and 2s', () => {
    expect(botBid(cards('X x 2s 2h 2d Ac Ah Ad Ks Kh 9s 9h 5s 5h 5d 5c 3s'), 0)).toBe(3);
  });

  it('passes on a weak hand', () => {
    expect(botBid(cards('3s 4h 5d 6c 8s 9h Td Jc Qs 3h 4d 6h 7c 8d 9c Ts Jd'), 0)).toBe(0);
  });

  it('bids something in between on a decent hand', () => {
    const bidValue = botBid(cards('2s 2h Ac Ah Ks Kh Qd 9s 9h 7d 6c 5s 4h 3d 3c 8s 8h'), 0);
    expect(bidValue).toBeGreaterThanOrEqual(1);
    expect(bidValue).toBeLessThanOrEqual(2);
  });

  it('never bids what is not allowed: a pass, or a bid above the last one', () => {
    const random = seeded(11);
    for (let i = 0; i < 300; i++) {
      const hand = deal(shuffled(random)).hands[0];
      const highest = Math.floor(random() * 4); // 0, 1, 2 or 3
      const state = { ...startBidding(0), value: highest, done: highest === 3 };
      if (highest === 3) continue; // nothing left to bid
      expect(legalBids(state)).toContain(botBid(hand, highest));
    }
  });

  it('passes when its hand is not worth more than the bid already made', () => {
    expect(botBid(cards('2s 2h Ac Ah Ks Kh Qd 9s 9h 7d 6c 5s 4h 3d 3c 8s 8h'), 2)).toBe(0);
  });
});

describe('estimating how many turns a hand needs', () => {
  it('counts a bomb, the rocket, a straight and the odd cards', () => {
    expect(turnsToEmpty(cards('5s 5h 5d 5c'), options())).toBe(1);
    expect(turnsToEmpty(cards('x X'), options())).toBe(1);
    expect(turnsToEmpty(cards('3s 4h 5d 6c 7s'), options())).toBe(1);
    expect(turnsToEmpty(cards('3s 4h 5d 6c 7s Kh'), options())).toBe(2);
    expect(turnsToEmpty(cards('3s 9h Kd'), options())).toBe(3);
  });

  it('lets a triple carry a spare card or pair in the same turn', () => {
    expect(turnsToEmpty(cards('5s 5h 5d 9c'), options())).toBe(1);
    expect(turnsToEmpty(cards('5s 5h 5d 9c 9h'), options())).toBe(1);
  });

  it('counts pairs as one turn each', () => {
    expect(turnsToEmpty(cards('4s 4h 9d 9c Kh Kd'), options())).toBe(3);
  });

  it('is zero for an empty hand', () => {
    expect(turnsToEmpty([], options())).toBe(0);
  });
});

describe('leading', () => {
  it('goes out when it can in one play', () => {
    expect(move(table(['5s 5h', '3s 9h', '4s 7h']))).toBe('5,5');
  });

  it('leads its lowest card when it has nothing to group', () => {
    expect(move(table(['3s 9h Kd', '4s 7h 8h 9d', '5s 6h Th Jd']))).toBe('3');
  });

  it('leads a straight rather than breaking it up into singles', () => {
    expect(move(table(['3s 4s 5h 6d 7c Kh', '8s 9h Td Jh', '2s 2h Ah']))).toBe('3,4,5,6,7');
  });

  it('keeps its bombs and the rocket for later', () => {
    expect(move(table(['5s 5h 5d 5c x X 9h', '3s 4h 6d', '7s 8h Td']))).toBe('9');
  });

  it('leads a pair rather than a single when an opponent is down to one card', () => {
    // Seat 1 is the landlord with one card left; seat 0 is a peasant.
    expect(move(table(['3s 9h 9d', '4s', '6s 7h 8d'], { landlord: 1, turn: 0 }))).toBe('9,9');
    expect(move(table(['3s 9h 9d', '4s 5h 8d', '6s 7h Td'], { landlord: 1, turn: 0 }))).toBe('3');
  });

  it('leads its highest single when it must lead a single against a player on one card', () => {
    expect(move(table(['3s 5h 8d', '4s', '6s 7h Td'], { landlord: 1, turn: 0 }))).toBe('8');
  });

  it('does not worry about a partner on one card', () => {
    // Seat 2 is a peasant too, with one card.
    expect(move(table(['3s 9h 9d', '4s 5h 8d', '6s'], { landlord: 1, turn: 0 }))).toBe('3');
  });

  it('as the landlord, treats both peasants as opponents', () => {
    expect(move(table(['3s 9h 9d', '4s 5h 8d', '6s'], { landlord: 0, turn: 0 }))).toBe('9,9');
  });
});

describe('following', () => {
  it('beats the play with the lowest card that does', () => {
    expect(move(table(['6s 9h Kd', '3s 4h 7d', '8s Th Jd'], { turn: 0, last: { seat: 1, text: '5s' } }))).toBe('6');
  });

  it('passes when it cannot beat the play', () => {
    expect(move(table(['3s 4h', '6s 9h Kd', '8s Th Jd'], { turn: 0, last: { seat: 1, text: '5s' } }))).toBe('pass');
  });

  it('beats a pair with a pair, not with a bomb', () => {
    expect(move(table(['7s 7h 9c 9d 9h 9s Kd', '3s 4h 6d', '8s Th Jd'], { turn: 0, last: { seat: 1, text: '5s 5h' } }))).toBe('7,7');
  });

  it('does not break a bomb into a smaller play', () => {
    // The only way to beat the 4 with a single would be to split the fours, so it passes instead.
    expect(move(table(['3s 4h 6d', '9s 9h 9d 9c 3h', '8s Th Jd'], { turn: 1, landlord: 1, last: { seat: 0, text: '5s' } }))).toBe('pass');
  });

  it('does not split the rocket to beat a single', () => {
    expect(move(table(['x X 3s', '3h 4h 6d', '8s Th Jd'], { turn: 0, landlord: 1, last: { seat: 1, text: '2s' } }))).toBe('pass');
  });

  it('plays a bomb when an opponent is nearly out', () => {
    // Seat 1, the landlord, has two cards left and has just played a pair of aces.
    const round = table(['5s 5h 5d 5c 3s 4h', '2s 2h', '6s 7h 8d'], { turn: 0, landlord: 1, last: { seat: 1, text: 'As Ah' } });
    expect(move(round)).toBe('5,5,5,5');
  });

  it('keeps a bomb when the opponents still have plenty of cards', () => {
    const round = table(['5s 5h 5d 5c 3s 4h', '2s 2h 6c 6d 8c 8d', '6s 7h 8d 9d Td Jd'], { turn: 0, landlord: 1, last: { seat: 1, text: 'As Ah' } });
    expect(move(round)).toBe('pass');
  });

  it('plays a bomb to go out', () => {
    const round = table(['5s 5h 5d 5c', '2s 2h 6c', '6s 7h 8d'], { turn: 0, landlord: 1, last: { seat: 1, text: 'As Ah' } });
    expect(move(round)).toBe('5,5,5,5');
  });

  it('as a peasant, lets a partner who is winning the round keep it', () => {
    // Seat 2 (a peasant) played the 5; seat 0 (a peasant) could beat it with the 6.
    expect(move(table(['6s 9h Kd', '3s 4h 7d', '5s Th Jd'], { turn: 0, landlord: 1, last: { seat: 2, text: '5s' } }))).toBe('pass');
  });

  it('as a peasant, still goes out when it can, even over a partner', () => {
    expect(move(table(['6s', '3s 4h 7d', '5s Th Jd'], { turn: 0, landlord: 1, last: { seat: 2, text: '5s' } }))).toBe('6');
  });

  it('as a peasant, beats the landlord', () => {
    expect(move(table(['6s 9h Kd', '5s 4h 7d', '3s Th Jd'], { turn: 0, landlord: 1, last: { seat: 1, text: '5s' } }))).toBe('6');
  });

  it('as the landlord, beats either peasant', () => {
    expect(move(table(['6s 9h Kd', '5s 4h 7d', '3s Th Jd'], { turn: 0, landlord: 0, last: { seat: 2, text: '5s' } }))).toBe('6');
  });
});

describe('honesty', () => {
  it('only ever looks at its own hand and what has been played', () => {
    // The same hand and the same table give the same move, whatever the others hold.
    const a = table(['3s 9h Kd', '4s 7h 8h 9d', '5s 6h Th Jd'], { landlord: 0, turn: 0 });
    const b = table(['3s 9h Kd', '2s 2h 2d 2c x X', 'As Ah Ad'], { landlord: 0, turn: 0 });
    expect(move(a)).toBe(move(b));
  });

  it('is not allowed to play for a seat whose turn it is not', () => {
    expect(botPlay(table(['3s', '4s', '5s']), 1)).toBeNull();
  });
});

describe('whole rounds', () => {
  function playOut(seed: number, rules: RuleOptions) {
    const random = seeded(seed);
    const { hands, bottom } = deal(shuffled(random));
    const landlord = Math.floor(random() * 3);
    let round = startRound(hands, bottom, landlord, 1, rules);
    let steps = 0;
    while (round.winner === null) {
      if (++steps > 1000) throw new Error(`round ${seed} did not finish`);
      const seat = round.turn;
      const chosen = botPlay(round, seat);
      const next = chosen ? play(round, chosen) : pass(round);
      // A move the rules refuse leaves the round untouched, and the bots must never try one.
      if (next === round) throw new Error(`round ${seed}: seat ${seat} made an illegal move`);
      round = next;
    }
    return round;
  }

  it('always finishes, and the bots never make an illegal move', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const round = playOut(seed, options());
      expect(round.winner).not.toBeNull();
    }
  });

  it('plays legally with every rule option switched on or off', () => {
    const variants = [
      options({ planes: false }),
      options({ fourWithTwo: false }),
      options({ pairRuns: false }),
      options({ straightFlush: true }),
      options({ planes: false, fourWithTwo: false, pairRuns: false }),
    ];
    for (const [i, rules] of variants.entries()) {
      for (let seed = 1; seed <= 40; seed++) {
        expect(playOut(seed + i * 1000, rules).winner).not.toBeNull();
      }
    }
  });

  it('is fair enough that both sides win rounds', () => {
    let landlordWins = 0;
    let peasantWins = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const round = playOut(seed, options());
      if (round.winner === round.landlord) landlordWins++;
      else peasantWins++;
    }
    expect(landlordWins).toBeGreaterThan(15);
    expect(peasantWins).toBeGreaterThan(15);
  });

  it('bots bidding with a full auction always end with a legal result', () => {
    const random = seeded(5);
    for (let i = 0; i < 100; i++) {
      const { hands } = deal(shuffled(random));
      let state = startBidding(i % 3);
      let guard = 0;
      while (!state.done) {
        if (++guard > 10) throw new Error('auction did not finish');
        const amount = botBid(hands[state.turn], state.value);
        expect(legalBids(state)).toContain(amount);
        state = bid(state, amount);
      }
      expect(state.redeal || state.landlord !== null).toBe(true);
    }
  });
});
