/**
 * European roulette: one wheel with 37 pockets, 0 to 36. A bet covers some of the numbers and wins if the ball
 * lands on one of them. A bet covering n numbers pays 36 / n times its amount back (stake included), which
 * is the familiar 35 to 1 for a single number, 17 to 1 for a split, 1 to 1 for red, and so on.
 */
export const POCKETS = 37;

/** The numbers in the order they sit around the wheel, clockwise from 0. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED_NUMBERS: ReadonlySet<number> = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Colour = 'red' | 'black' | 'green';
export const colourOf = (n: number): Colour => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');

export type BetKind =
  | 'straight'
  | 'split'
  | 'street'
  | 'corner'
  | 'sixline'
  | 'dozen'
  | 'column'
  | 'red'
  | 'black'
  | 'odd'
  | 'even'
  | 'low'
  | 'high';

/** A place on the table where chips can go: what kind of bet it is and which numbers it covers. */
export interface Spot {
  kind: BetKind;
  /** Sorted, lowest first. */
  numbers: number[];
}
export interface Bet extends Spot {
  amount: number;
}

export const spotId = (spot: Spot) => `${spot.kind}:${spot.numbers.join('-')}`;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const sorted = (numbers: number[]) => [...numbers].sort((a, b) => a - b);

// ---------------------------------------------------------------- the table layout

/** The table has 12 columns of 3 numbers. The top row is 3, 6, 9... the bottom row is 1, 4, 7... */
export const COLUMNS = 12;
export const ROWS = 3;
export const boardNumber = (column: number, row: number) => 3 * column + 3 - row;

// ---------------------------------------------------------------- spots

export const straightSpot = (n: number): Spot => ({ kind: 'straight', numbers: [n] });

/** Two numbers that touch on the table (0 touches 1, 2 and 3). Null if these two don't touch. */
export function splitSpot(a: number, b: number): Spot | null {
  const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n <= 36;
  if (!inRange(a) || !inRange(b) || a === b) return null;
  const [low, high] = sorted([a, b]);
  const touches =
    low === 0
      ? high <= 3
      : high - low === 3 || (high - low === 1 && Math.floor((low - 1) / 3) === Math.floor((high - 1) / 3));
  return touches ? { kind: 'split', numbers: [low, high] } : null;
}

/** The three numbers across one column of the table, such as 7-8-9. */
export const streetSpot = (column: number): Spot => ({ kind: 'street', numbers: range(3 * column + 1, 3 * column + 3) });

/** The four numbers around a point where two columns and two rows meet. */
export const cornerSpot = (column: number, row: number): Spot => ({
  kind: 'corner',
  numbers: sorted([boardNumber(column, row), boardNumber(column + 1, row), boardNumber(column, row + 1), boardNumber(column + 1, row + 1)]),
});

/** The six numbers of two neighbouring columns. */
export const sixLineSpot = (column: number): Spot => ({ kind: 'sixline', numbers: range(3 * column + 1, 3 * column + 6) });

export const dozenSpot = (index: 0 | 1 | 2): Spot => ({ kind: 'dozen', numbers: range(12 * index + 1, 12 * index + 12) });
/** Column 0 is 1, 4, 7... and column 2 is 3, 6, 9... */
export const columnSpot = (index: 0 | 1 | 2): Spot => ({
  kind: 'column',
  numbers: range(1, 36).filter((n) => (n - 1) % 3 === index),
});

type EvenMoney = 'red' | 'black' | 'odd' | 'even' | 'low' | 'high';
const EVEN_MONEY: Record<EvenMoney, (n: number) => boolean> = {
  red: (n) => colourOf(n) === 'red',
  black: (n) => colourOf(n) === 'black',
  odd: (n) => n % 2 === 1,
  even: (n) => n % 2 === 0,
  low: (n) => n <= 18,
  high: (n) => n >= 19,
};
/** Bets on half the table. Zero is never part of them, which is how the house keeps its edge. */
export const evenMoneySpot = (kind: EvenMoney): Spot => ({ kind, numbers: range(1, 36).filter(EVEN_MONEY[kind]) });

// ---------------------------------------------------------------- payouts

/** Coins handed back per coin staked on a bet this wide, the stake included. A single number is 36, red is 2. */
export const returnMultiple = (numbers: readonly number[]) => 36 / numbers.length;
/** The "N to 1" figure: what a win pays on top of getting the stake back. */
export const payoutOdds = (numbers: readonly number[]) => returnMultiple(numbers) - 1;

export const totalStake = (bets: readonly Bet[]) => bets.reduce((sum, b) => sum + b.amount, 0);

/** Coins handed back for these bets when the ball lands on `result`, stakes included. Losing bets return nothing. */
export const returnedFor = (bets: readonly Bet[], result: number) =>
  bets.reduce((sum, b) => (b.numbers.includes(result) ? sum + b.amount * returnMultiple(b.numbers) : sum), 0);

// ---------------------------------------------------------------- placing chips

/** Puts `chip` coins on a spot, on top of whatever is already there. */
export function placeChip(bets: readonly Bet[], spot: Spot, chip: number): Bet[] {
  const id = spotId(spot);
  if (bets.some((b) => spotId(b) === id)) return bets.map((b) => (spotId(b) === id ? { ...b, amount: b.amount + chip } : b));
  return [...bets, { ...spot, amount: chip }];
}

/** Takes `chip` coins back off a spot, and clears the spot when nothing is left. */
export function removeChip(bets: readonly Bet[], spot: Spot, chip: number): Bet[] {
  const id = spotId(spot);
  return bets.flatMap((b) => {
    if (spotId(b) !== id) return [b];
    const amount = b.amount - chip;
    return amount > 0 ? [{ ...b, amount }] : [];
  });
}

/** A random pocket. `random` is a number from 0 up to (not including) 1, replaceable so tests can choose the result. */
export const spinWheel = (random: number = Math.random()): number => Math.min(POCKETS - 1, Math.floor(random * POCKETS));

/** The most results kept in the history strip. */
export const HISTORY_SIZE = 12;

/** Chip values to choose from. */
export const CHIPS = [1, 5, 10, 25, 100] as const;
