/**
 * A classic three-reel slot machine with one payline across the middle. Each reel is a ring of 20 stops, and
 * every stop is equally likely, so the odds of every outcome can be worked out exactly.
 */
export type SlotSymbol = 'cherry' | 'lemon' | 'grape' | 'bell' | 'diamond' | 'seven';

/**
 * The symbols are Glaggles, and these are their names (see `components/GlaggleFace.tsx` for their faces). The
 * symbol ids above stay as they were, because the pay table and the odds are written in terms of them.
 */
export const SYMBOL_NAME: Record<SlotSymbol, string> = {
  cherry: 'Giggler',
  lemon: 'Gazo',
  grape: 'Gloober',
  bell: 'Gembo',
  diamond: 'Gleeber',
  seven: 'Glabber',
};

/** The ring each reel spins. Cheap symbols are common and the 7 and diamond are rare, spread out evenly. */
export const STRIP: readonly SlotSymbol[] = [
  'cherry', 'lemon', 'grape', 'cherry', 'bell', 'lemon', 'cherry', 'grape', 'diamond', 'lemon',
  'cherry', 'bell', 'lemon', 'grape', 'cherry', 'seven', 'lemon', 'cherry', 'bell', 'grape',
];
export const REELS = 3;
export const STOPS = STRIP.length;

/** Coins handed back per coin bet for three of a kind, the stake included. */
export const THREE_OF_A_KIND: Record<SlotSymbol, number> = {
  seven: 100,
  diamond: 40,
  bell: 20,
  grape: 10,
  lemon: 6,
  cherry: 5,
};
/** Exactly two cherries anywhere on the line. */
export const TWO_CHERRIES = 3;

export type Line = readonly [SlotSymbol, SlotSymbol, SlotSymbol];

/** Coins handed back per coin bet for what is on the payline. 0 means the spin lost. */
export function lineReturn(line: Line): number {
  const [a, b, c] = line;
  if (a === b && b === c) return THREE_OF_A_KIND[a];
  if (line.filter((s) => s === 'cherry').length === 2) return TWO_CHERRIES;
  return 0;
}

/** The stop each reel lands on, from three numbers between 0 and 1. */
export const stopsFor = (random: () => number): [number, number, number] => [
  Math.min(STOPS - 1, Math.floor(random() * STOPS)),
  Math.min(STOPS - 1, Math.floor(random() * STOPS)),
  Math.min(STOPS - 1, Math.floor(random() * STOPS)),
];

/** What a reel shows when it stops at `stop`: the symbol above the line, on it, and below it. */
export function windowAt(stop: number): [SlotSymbol, SlotSymbol, SlotSymbol] {
  const at = (i: number) => STRIP[((i % STOPS) + STOPS) % STOPS];
  return [at(stop - 1), at(stop), at(stop + 1)];
}

export const lineAt = (stops: readonly number[]): Line => [STRIP[stops[0]], STRIP[stops[1]], STRIP[stops[2]]];

/** Coins handed back, stake included, for a bet when the reels stop on these positions. */
export const returnedFor = (bet: number, stops: readonly number[]) => bet * lineReturn(lineAt(stops));

/**
 * The share of every coin bet that comes back over time, worked out by trying all 8,000 positions the reels
 * can stop in. About 0.96 means 96 coins back for every 100 bet, in the long run.
 */
export const RETURN_TO_PLAYER = (() => {
  let total = 0;
  for (let a = 0; a < STOPS; a++) for (let b = 0; b < STOPS; b++) for (let c = 0; c < STOPS; c++) total += lineReturn([STRIP[a], STRIP[b], STRIP[c]]);
  return total / STOPS ** REELS;
})();

/** How often a spin pays anything, from 0 to 1. */
export const HIT_RATE = (() => {
  let hits = 0;
  for (let a = 0; a < STOPS; a++) for (let b = 0; b < STOPS; b++) for (let c = 0; c < STOPS; c++) if (lineReturn([STRIP[a], STRIP[b], STRIP[c]]) > 0) hits++;
  return hits / STOPS ** REELS;
})();
