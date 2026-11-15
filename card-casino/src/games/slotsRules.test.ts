import { describe, expect, it } from 'vitest';
import {
  HIT_RATE,
  RETURN_TO_PLAYER,
  STOPS,
  STRIP,
  THREE_OF_A_KIND,
  TWO_CHERRIES,
  lineAt,
  lineReturn,
  returnedFor,
  stopsFor,
  windowAt,
  type SlotSymbol,
} from './slotsRules';

const count = (symbol: SlotSymbol) => STRIP.filter((s) => s === symbol).length;

describe('the reels', () => {
  it('have 20 stops, with the rare symbols rare', () => {
    expect(STOPS).toBe(20);
    expect([count('cherry'), count('lemon'), count('grape'), count('bell'), count('diamond'), count('seven')]).toEqual([6, 5, 4, 3, 1, 1]);
  });

  it('never put two of the same symbol side by side, even where the ring wraps round', () => {
    for (let i = 0; i < STOPS; i++) expect(STRIP[i]).not.toBe(STRIP[(i + 1) % STOPS]);
  });

  it('show the symbol above and below the line, wrapping round the ends of the ring', () => {
    expect(windowAt(5)).toEqual([STRIP[4], STRIP[5], STRIP[6]]);
    expect(windowAt(0)).toEqual([STRIP[STOPS - 1], STRIP[0], STRIP[1]]);
    expect(windowAt(STOPS - 1)).toEqual([STRIP[STOPS - 2], STRIP[STOPS - 1], STRIP[0]]);
  });

  it('stop on a position from a random number, never past the end', () => {
    expect(stopsFor(() => 0)).toEqual([0, 0, 0]);
    expect(stopsFor(() => 0.999999)).toEqual([19, 19, 19]);
    expect(stopsFor(() => 1)).toEqual([19, 19, 19]);
    const numbers = [0.0, 0.5, 0.26];
    let i = 0;
    expect(stopsFor(() => numbers[i++])).toEqual([0, 10, 5]);
  });
});

describe('what the line pays', () => {
  it('pays three of a kind at the paytable', () => {
    for (const symbol of Object.keys(THREE_OF_A_KIND) as SlotSymbol[]) {
      expect(lineReturn([symbol, symbol, symbol])).toBe(THREE_OF_A_KIND[symbol]);
    }
    expect(THREE_OF_A_KIND.seven).toBe(100);
  });

  it('pays more for rarer symbols', () => {
    const order: SlotSymbol[] = ['cherry', 'lemon', 'grape', 'bell', 'diamond', 'seven'];
    for (let i = 1; i < order.length; i++) expect(THREE_OF_A_KIND[order[i]]).toBeGreaterThan(THREE_OF_A_KIND[order[i - 1]]);
  });

  it('pays for exactly two cherries wherever they are', () => {
    expect(lineReturn(['cherry', 'cherry', 'lemon'])).toBe(TWO_CHERRIES);
    expect(lineReturn(['cherry', 'lemon', 'cherry'])).toBe(TWO_CHERRIES);
    expect(lineReturn(['bell', 'cherry', 'cherry'])).toBe(TWO_CHERRIES);
  });

  it('pays three cherries as three of a kind, not as two cherries as well', () => {
    expect(lineReturn(['cherry', 'cherry', 'cherry'])).toBe(THREE_OF_A_KIND.cherry);
  });

  it('pays nothing for one cherry, or for anything else', () => {
    expect(lineReturn(['cherry', 'lemon', 'bell'])).toBe(0);
    expect(lineReturn(['lemon', 'lemon', 'bell'])).toBe(0);
    expect(lineReturn(['seven', 'seven', 'diamond'])).toBe(0);
    expect(lineReturn(['grape', 'bell', 'lemon'])).toBe(0);
  });

  it('works out coins handed back for a bet, from where the reels stopped', () => {
    const sevens = STRIP.indexOf('seven');
    expect(lineAt([sevens, sevens, sevens])).toEqual(['seven', 'seven', 'seven']);
    expect(returnedFor(10, [sevens, sevens, sevens])).toBe(1000);
    const lemon = STRIP.indexOf('lemon');
    const bell = STRIP.indexOf('bell');
    expect(returnedFor(10, [lemon, bell, lemon])).toBe(0);
  });
});

describe('the odds', () => {
  it('pays back about 96 coins in every 100 bet, over time', () => {
    // 0.39375 from three of a kind plus 0.567 from exactly two cherries.
    expect(RETURN_TO_PLAYER).toBeCloseTo(0.96075, 10);
    expect(RETURN_TO_PLAYER).toBeLessThan(1); // the house always has an edge
  });

  it('pays something on about a quarter of spins', () => {
    expect(HIT_RATE).toBeCloseTo(1946 / 8000, 10);
  });

  it('agrees with spinning every possible position by hand', () => {
    let total = 0;
    for (let a = 0; a < STOPS; a++) for (let b = 0; b < STOPS; b++) for (let c = 0; c < STOPS; c++) total += returnedFor(1, [a, b, c]);
    expect(total / STOPS ** 3).toBeCloseTo(RETURN_TO_PLAYER, 12);
  });

  it('is close to its figure when really played many times', () => {
    // A deterministic stream of numbers, so this can never fail by bad luck.
    let seed = 12345;
    const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let back = 0;
    const SPINS = 200_000;
    for (let i = 0; i < SPINS; i++) back += returnedFor(1, stopsFor(random));
    expect(back / SPINS).toBeGreaterThan(0.9);
    expect(back / SPINS).toBeLessThan(1.02);
  });
});
