import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, newLandlordDeck, type LCard } from './landlordRules';
import { botPlay } from './landlordBots';
import { YOU, botStep, giveUp, playerPass, playerPlay, playerBid, redeal, settlementOf, startTable, type Table } from './landlordTable';
import { cards, seeded } from './landlordTestUtils';

const shuffled = (seed: number): LCard[] => {
  const random = seeded(seed);
  return [...newLandlordDeck()].sort(() => random() - 0.5);
};

/** Steps the bots until it is the player's turn, or the table is over. */
function untilYou(table: Table): Table {
  let next = table;
  for (let i = 0; i < 200; i++) {
    const after = botStep(next);
    if (after === next) return next;
    next = after;
  }
  throw new Error('the bots never stopped');
}

/** A deck where seat 0 holds the rocket, bombs and 2s, so it can bid 3. */
function strongDeck(): LCard[] {
  const rest = newLandlordDeck();
  const want = cards('X x 2s 2h 2d 2c As Ah Ad Ac Ks Kh Kd Kc 5s');
  const ids = new Set(want.map((w) => `${w.rank}${w.suit ?? ''}`));
  const mine = rest.filter((c) => ids.has(`${c.rank}${c.suit ?? ''}`));
  const others = rest.filter((c) => !ids.has(`${c.rank}${c.suit ?? ''}`));
  // Seat 0 gets every third card: put its cards at positions 0, 3, 6, ...
  const deck: LCard[] = [];
  let m = 0;
  let o = 0;
  for (let i = 0; i < 54; i++) deck.push(i % 3 === 0 && m < mine.length ? mine[m++] : others[o++]);
  return deck;
}

describe('starting a table', () => {
  it('deals 17 cards to each seat and keeps three back, and starts the bidding with the chosen seat', () => {
    const table = startTable(50, DEFAULT_OPTIONS, shuffled(1), 1);
    expect(table.hands.map((h) => h.length)).toEqual([17, 17, 17]);
    expect(table.bottom).toHaveLength(3);
    expect(table.phase).toBe('bidding');
    expect(table.bidding.turn).toBe(1);
    expect(table.round).toBeNull();
    expect(table.bet).toBe(50);
  });

  it('keeps each hand sorted, highest first', () => {
    const table = startTable(50, DEFAULT_OPTIONS, shuffled(2), 0);
    for (const hand of table.hands) {
      const ranks = hand.map((c) => c.rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    }
  });
});

describe('bidding', () => {
  it('lets you bid 3, which makes you the landlord straight away with the three extra cards', () => {
    const table = playerBid(startTable(50, DEFAULT_OPTIONS, strongDeck(), YOU), 3);
    expect(table.phase).toBe('playing');
    expect(table.round!.landlord).toBe(YOU);
    expect(table.round!.bid).toBe(3);
    expect(table.round!.hands[YOU]).toHaveLength(20);
    expect(table.round!.turn).toBe(YOU);
  });

  it('ignores a bid you are not allowed to make, or when it is not your turn', () => {
    const table = startTable(50, DEFAULT_OPTIONS, shuffled(3), 1);
    expect(playerBid(table, 2)).toBe(table);
    const mine = startTable(50, DEFAULT_OPTIONS, shuffled(3), YOU);
    expect(playerBid(playerBid(mine, 2), 1)).toEqual(playerBid(mine, 2));
  });

  it('lets the bots bid on their turns, one bid at a time, and stops at yours', () => {
    const start = startTable(50, DEFAULT_OPTIONS, strongDeck(), 1);
    const afterOne = botStep(start);
    expect(afterOne.bidding.bids.filter((b) => b !== null)).toHaveLength(1);
    const ready = untilYou(start);
    expect(ready.phase === 'bidding' ? ready.bidding.turn : YOU).toBe(YOU);
  });

  it('makes the highest bidder the landlord when the bidding ends', () => {
    const table = untilYou(playerBid(untilYou(startTable(50, DEFAULT_OPTIONS, strongDeck(), 1)), 3));
    expect(table.round?.landlord).toBe(YOU);
  });

  it('deals again, with the same bet and no charge, when everybody passes', () => {
    // A deck of weak hands for all three: nobody bids.
    let table = startTable(50, DEFAULT_OPTIONS, shuffled(40), 0);
    const weak = (seed: number) => {
      for (let s = seed; s < seed + 400; s++) {
        const t = startTable(50, DEFAULT_OPTIONS, shuffled(s), 0);
        const passed = untilYou(playerBid(t, 0));
        if (passed.bidding.redeal) return s;
      }
      throw new Error('no all-pass deal found');
    };
    const seed = weak(1);
    table = untilYou(playerBid(startTable(50, DEFAULT_OPTIONS, shuffled(seed), 0), 0));
    expect(table.bidding.redeal).toBe(true);
    const again = redeal(table, shuffled(seed + 1000), 1);
    expect(again.phase).toBe('bidding');
    expect(again.bidding.redeal).toBe(false);
    expect(again.bidding.turn).toBe(1);
    expect(again.bet).toBe(50);
    expect(again.redeals).toBe(1);
    expect(again.hands.map((h) => h.length)).toEqual([17, 17, 17]);
  });
});

describe('playing', () => {
  const landlordTable = () => untilYou(playerBid(startTable(50, DEFAULT_OPTIONS, strongDeck(), YOU), 3));

  it('removes the cards you play from your hand and moves the turn on', () => {
    const table = landlordTable();
    const single = [table.round!.hands[YOU][table.round!.hands[YOU].length - 1]]; // your lowest card
    const next = playerPlay(table, single);
    expect(next.round!.hands[YOU]).toHaveLength(19);
    expect(next.round!.last!.seat).toBe(YOU);
  });

  it('ignores a play the rules do not allow', () => {
    const table = landlordTable();
    const hand = table.round!.hands[YOU];
    expect(playerPlay(table, [hand[0], hand[hand.length - 1]])).toBe(table);
  });

  it('does not let you pass when you are leading', () => {
    const table = landlordTable();
    expect(playerPass(table)).toBe(table);
  });

  it('does nothing for the bots while it is your turn', () => {
    const table = landlordTable();
    expect(botStep(table)).toBe(table);
  });

  it('remembers if you played the rocket', () => {
    const table = landlordTable();
    expect(table.youPlayedRocket).toBe(false);
    const rocket = table.round!.hands[YOU].filter((c) => c.rank >= 16);
    const next = playerPlay(table, rocket);
    expect(next.youPlayedRocket).toBe(true);
  });

  it('plays a whole round with the bots, ending with a winner and a result', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let table = untilYou(startTable(50, DEFAULT_OPTIONS, shuffled(seed), 0));
      let guard = 0;
      while (table.phase !== 'over') {
        if (++guard > 400) throw new Error(`round ${seed} did not finish`);
        if (table.phase === 'bidding' && table.bidding.redeal) {
          table = redeal(table, shuffled(seed + 500 + guard), 0);
          continue;
        }
        if (table.phase === 'bidding') {
          table = playerBid(table, table.bidding.value >= 1 ? 0 : 1);
        } else if (table.round!.turn === YOU) {
          const chosen = botPlay(table.round!, YOU);
          const next = chosen ? playerPlay(table, chosen) : playerPass(table);
          if (next === table) throw new Error(`round ${seed}: you were left with no legal move`);
          table = next;
        }
        table = untilYou(table);
      }
      expect(table.round!.winner).not.toBeNull();
      const result = settlementOf(table, 1000);
      expect(result.won ? result.returned : 0).toBeGreaterThanOrEqual(result.won ? 50 : 0);
    }
  });
});

describe('giving up', () => {
  it('ends the round as a loss at the multiplier so far', () => {
    const table = untilYou(playerBid(startTable(50, DEFAULT_OPTIONS, strongDeck(), YOU), 3));
    const over = giveUp(table);
    expect(over.phase).toBe('over');
    expect(over.round!.forfeitedBy).toBe(YOU);
    const result = settlementOf(over, 1000);
    expect(result.won).toBe(false);
    expect(result.returned).toBe(0);
    // Landlord at a multiplier of 3, bet 50: a quarter of 150.
    expect(result.extra).toBe(37);
  });

  it('is only possible once the round is being played', () => {
    const table = startTable(50, DEFAULT_OPTIONS, shuffled(5), YOU);
    expect(giveUp(table)).toBe(table);
  });
});

describe('what the round pays', () => {
  const lost = () => giveUp(untilYou(playerBid(startTable(50, DEFAULT_OPTIONS, strongDeck(), YOU), 3)));

  it('takes the extra part of a loss from what the player has', () => {
    expect(settlementOf(lost(), 1000)).toMatchObject({ won: false, returned: 0, extra: 37 });
  });

  it('takes no more than the player has, so the balance never goes below zero', () => {
    expect(settlementOf(lost(), 10)).toMatchObject({ extra: 10 });
    expect(settlementOf(lost(), 0)).toMatchObject({ extra: 0 });
  });
});
