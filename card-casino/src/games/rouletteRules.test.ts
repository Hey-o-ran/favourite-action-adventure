import { describe, expect, it } from 'vitest';
import {
  POCKETS,
  WHEEL_ORDER,
  boardNumber,
  colourOf,
  columnSpot,
  cornerSpot,
  dozenSpot,
  evenMoneySpot,
  payoutOdds,
  placeChip,
  removeChip,
  returnedFor,
  returnMultiple,
  sixLineSpot,
  spinWheel,
  splitSpot,
  spotId,
  straightSpot,
  streetSpot,
  totalStake,
  type Bet,
} from './rouletteRules';

const bet = (spot: { kind: Bet['kind']; numbers: number[] }, amount: number): Bet => ({ ...spot, amount });

describe('the wheel', () => {
  it('has all 37 pockets exactly once, starting at 0', () => {
    expect(WHEEL_ORDER).toHaveLength(POCKETS);
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
    expect(WHEEL_ORDER[0]).toBe(0);
  });

  it('colours 0 green and splits the rest into 18 red and 18 black', () => {
    expect(colourOf(0)).toBe('green');
    const colours = Array.from({ length: 36 }, (_, i) => colourOf(i + 1));
    expect(colours.filter((c) => c === 'red')).toHaveLength(18);
    expect(colours.filter((c) => c === 'black')).toHaveLength(18);
    expect([colourOf(1), colourOf(2), colourOf(17), colourOf(32), colourOf(36)]).toEqual(['red', 'black', 'black', 'red', 'red']);
  });

  it('puts reds and blacks alternately round the wheel, apart from the zero', () => {
    const colours = WHEEL_ORDER.slice(1).map(colourOf);
    for (let i = 1; i < colours.length; i++) expect(colours[i]).not.toBe(colours[i - 1]);
  });

  it('picks the pocket from a number between 0 and 1, and never one past the end', () => {
    expect(spinWheel(0)).toBe(0);
    expect(spinWheel(0.5)).toBe(18);
    expect(spinWheel(0.999999)).toBe(36);
    expect(spinWheel(1)).toBe(36);
  });
});

describe('the table layout', () => {
  it('puts 3 at the top of the first column and 1 at the bottom, and 36 in the top right', () => {
    expect([boardNumber(0, 0), boardNumber(0, 1), boardNumber(0, 2)]).toEqual([3, 2, 1]);
    expect(boardNumber(11, 0)).toBe(36);
    expect(boardNumber(11, 2)).toBe(34);
  });
});

describe('what each bet covers', () => {
  it('a single number covers just itself', () => {
    expect(straightSpot(17).numbers).toEqual([17]);
  });

  it('a split covers two numbers that touch, in either order, and 0 touches 1, 2 and 3', () => {
    expect(splitSpot(8, 5)?.numbers).toEqual([5, 8]);
    expect(splitSpot(5, 6)?.numbers).toEqual([5, 6]);
    expect(splitSpot(0, 2)?.numbers).toEqual([0, 2]);
    expect(splitSpot(3, 0)?.numbers).toEqual([0, 3]);
  });

  it('refuses a split of numbers that do not touch', () => {
    expect(splitSpot(3, 4)).toBeNull(); // different columns, one row apart on the table, but not neighbours
    expect(splitSpot(1, 5)).toBeNull();
    expect(splitSpot(0, 4)).toBeNull();
    expect(splitSpot(7, 7)).toBeNull();
    expect(splitSpot(36, 37)).toBeNull();
    expect(splitSpot(-1, 0)).toBeNull();
  });

  it('a street covers the three numbers across a column', () => {
    expect(streetSpot(0).numbers).toEqual([1, 2, 3]);
    expect(streetSpot(2).numbers).toEqual([7, 8, 9]);
    expect(streetSpot(11).numbers).toEqual([34, 35, 36]);
  });

  it('a corner covers the four numbers round a point', () => {
    expect(cornerSpot(0, 0).numbers).toEqual([2, 3, 5, 6]);
    expect(cornerSpot(0, 1).numbers).toEqual([1, 2, 4, 5]);
    expect(cornerSpot(10, 1).numbers).toEqual([31, 32, 34, 35]);
  });

  it('a six line covers two neighbouring columns', () => {
    expect(sixLineSpot(0).numbers).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sixLineSpot(10).numbers).toEqual([31, 32, 33, 34, 35, 36]);
  });

  it('dozens and columns cover 12 numbers each, and between them the whole table', () => {
    expect(dozenSpot(0).numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(dozenSpot(2).numbers[0]).toBe(25);
    expect(columnSpot(0).numbers).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(columnSpot(2).numbers).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
    for (const make of [dozenSpot, columnSpot]) {
      const all = [0, 1, 2].flatMap((i) => make(i as 0 | 1 | 2).numbers).sort((a, b) => a - b);
      expect(all).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    }
  });

  it('red, black, odd, even, low and high cover 18 numbers and never 0', () => {
    for (const kind of ['red', 'black', 'odd', 'even', 'low', 'high'] as const) {
      const { numbers } = evenMoneySpot(kind);
      expect(numbers).toHaveLength(18);
      expect(numbers).not.toContain(0);
    }
    expect(evenMoneySpot('low').numbers).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(evenMoneySpot('high').numbers[0]).toBe(19);
    expect(evenMoneySpot('red').numbers.every((n) => colourOf(n) === 'red')).toBe(true);
    expect(evenMoneySpot('odd').numbers.every((n) => n % 2 === 1)).toBe(true);
  });

  it('red and black, odd and even, low and high split the 36 numbers exactly in two', () => {
    for (const [a, b] of [['red', 'black'], ['odd', 'even'], ['low', 'high']] as const) {
      const both = [...evenMoneySpot(a).numbers, ...evenMoneySpot(b).numbers].sort((x, y) => x - y);
      expect(both).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
    }
  });
});

describe('payouts', () => {
  it('pays the familiar odds, with the stake handed back too', () => {
    const odds = (n: number) => payoutOdds(Array.from({ length: n }, (_, i) => i));
    expect([odds(1), odds(2), odds(3), odds(4), odds(6), odds(12), odds(18)]).toEqual([35, 17, 11, 8, 5, 2, 1]);
    expect(returnMultiple([7])).toBe(36);
    expect(returnMultiple(evenMoneySpot('red').numbers)).toBe(2);
  });

  it('pays 35 to 1 on a single number', () => {
    expect(returnedFor([bet(straightSpot(17), 10)], 17)).toBe(360);
    expect(returnedFor([bet(straightSpot(17), 10)], 18)).toBe(0);
  });

  it('pays for a split, street, corner and six line', () => {
    expect(returnedFor([bet(splitSpot(5, 8)!, 10)], 8)).toBe(180);
    expect(returnedFor([bet(streetSpot(2), 10)], 8)).toBe(120);
    expect(returnedFor([bet(cornerSpot(0, 1), 10)], 5)).toBe(90);
    expect(returnedFor([bet(sixLineSpot(0), 10)], 6)).toBe(60);
  });

  it('pays 2 to 1 for a dozen or a column, and evens for the half-table bets', () => {
    expect(returnedFor([bet(dozenSpot(1), 10)], 20)).toBe(30);
    expect(returnedFor([bet(columnSpot(0), 10)], 22)).toBe(30);
    expect(returnedFor([bet(evenMoneySpot('red'), 10)], 32)).toBe(20);
    expect(returnedFor([bet(evenMoneySpot('even'), 10)], 32)).toBe(20);
    expect(returnedFor([bet(evenMoneySpot('high'), 10)], 32)).toBe(20);
  });

  it('loses every half-table bet when the ball lands on 0', () => {
    const everything = (['red', 'black', 'odd', 'even', 'low', 'high'] as const).map((k) => bet(evenMoneySpot(k), 10));
    expect(returnedFor(everything, 0)).toBe(0);
  });

  it('only 0 itself wins on 0, and a straight bet on it pays 35 to 1', () => {
    expect(returnedFor([bet(straightSpot(0), 5)], 0)).toBe(180);
    expect(returnedFor([bet(splitSpot(0, 1)!, 5)], 0)).toBe(90);
  });

  it('adds up several winning bets and ignores the losing ones', () => {
    const bets = [bet(straightSpot(17), 10), bet(evenMoneySpot('black'), 20), bet(dozenSpot(1), 5), bet(evenMoneySpot('red'), 50)];
    // 17 is black and in the 13-24 dozen: 360 + 40 + 15, and the red bet loses.
    expect(returnedFor(bets, 17)).toBe(360 + 40 + 15);
    expect(totalStake(bets)).toBe(85);
  });

  it('is never in the players favour over the whole wheel: every bet returns 36 coins per 37 spins on average', () => {
    // For any bet covering n numbers, summed over the 37 pockets the return is n * (36 / n) = 36 per coin.
    for (const spot of [straightSpot(5), splitSpot(5, 8)!, streetSpot(3), cornerSpot(2, 1), sixLineSpot(4), dozenSpot(0), columnSpot(1), evenMoneySpot('red')]) {
      const total = Array.from({ length: 37 }, (_, n) => returnedFor([bet(spot, 1)], n)).reduce((a, b) => a + b, 0);
      expect(total).toBe(36);
    }
  });
});

describe('placing and taking back chips', () => {
  it('starts a bet on a new spot and stacks chips on a spot that already has some', () => {
    let bets = placeChip([], straightSpot(7), 10);
    bets = placeChip(bets, straightSpot(7), 5);
    bets = placeChip(bets, evenMoneySpot('red'), 25);
    expect(bets.map((b) => [spotId(b), b.amount])).toEqual([
      ['straight:7', 15],
      ['red:1-3-5-7-9-12-14-16-18-19-21-23-25-27-30-32-34-36', 25],
    ]);
  });

  it('keeps a split and a straight bet on the same number apart', () => {
    const bets = placeChip(placeChip([], straightSpot(5), 1), splitSpot(5, 8)!, 1);
    expect(bets).toHaveLength(2);
  });

  it('takes a chip back, and clears the spot when it is empty', () => {
    let bets = placeChip(placeChip([], straightSpot(7), 10), straightSpot(7), 5);
    bets = removeChip(bets, straightSpot(7), 5);
    expect(bets).toEqual([{ ...straightSpot(7), amount: 10 }]);
    expect(removeChip(bets, straightSpot(7), 10)).toEqual([]);
    expect(removeChip(bets, straightSpot(9), 10)).toEqual(bets);
  });

  it('does not change the bets it was given', () => {
    const bets = placeChip([], straightSpot(7), 10);
    placeChip(bets, straightSpot(7), 5);
    removeChip(bets, straightSpot(7), 5);
    expect(bets).toEqual([{ ...straightSpot(7), amount: 10 }]);
  });
});
