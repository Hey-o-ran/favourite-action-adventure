import { SUITS, shuffle, type Suit } from '../cards';

/*
 * Landlord (Dou Dizhu): three players, 54 cards. One player bids to be the landlord, takes 3 extra cards and plays
 * alone against the other two, who are partners. The first to play every card wins for their side.
 *
 * Ranks run 3 < 4 < ... < 10 < J < K... in `rank` numbers: 3 to 10, J 11, Q 12, K 13, A 14, 2 15, small joker 16,
 * big joker 17. Straights use 3 to A only: never a 2 or a joker.
 */

export const ACE = 14;
export const TWO = 15;
export const SMALL_JOKER = 16;
export const BIG_JOKER = 17;

export interface LCard {
  /** Tells apart the two cards of the same rank and suit that a test might build. 0 to 53 in a real deck. */
  id: number;
  rank: number;
  /** Jokers have no suit. */
  suit?: Suit;
}

/** The rules that can be switched on or off. Everything else is always on. */
export interface RuleOptions {
  /** Runs of two or more triples, bare or with a card or a pair for each. */
  planes: boolean;
  /** Four of a kind with two single cards, or with two pairs. */
  fourWithTwo: boolean;
  /** Three or more pairs in a row. */
  pairRuns: boolean;
  /** Five or more cards in a row, all one suit: a bomb that beats a four-of-a-kind. A house rule, so off by default. */
  straightFlush: boolean;
}

export const DEFAULT_OPTIONS: RuleOptions = { planes: true, fourWithTwo: true, pairRuns: true, straightFlush: false };

export function newLandlordDeck(): LCard[] {
  const deck: LCard[] = [];
  let id = 0;
  for (let rank = 3; rank <= TWO; rank++) for (const suit of SUITS) deck.push({ id: id++, rank, suit });
  deck.push({ id: id++, rank: SMALL_JOKER }, { id: id++, rank: BIG_JOKER });
  return deck;
}

const SUIT_ORDER: Record<string, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };

/** Highest rank first. */
export const sortHand = (hand: readonly LCard[]): LCard[] =>
  [...hand].sort((a, b) => b.rank - a.rank || (SUIT_ORDER[a.suit ?? ''] ?? 9) - (SUIT_ORDER[b.suit ?? ''] ?? 9) || a.id - b.id);

/** 17 cards to each seat, one at a time, and 3 left over for whoever becomes the landlord. */
export function deal(deck: readonly LCard[] = shuffle(newLandlordDeck())): { hands: LCard[][]; bottom: LCard[] } {
  const hands: LCard[][] = [[], [], []];
  for (let i = 0; i < 51; i++) hands[i % 3].push(deck[i]);
  return { hands: hands.map(sortHand), bottom: sortHand(deck.slice(51)) };
}

// ---- Combinations

export type ComboKind =
  | 'single'
  | 'pair'
  | 'triple'
  | 'tripleSingle'
  | 'triplePair'
  | 'straight'
  | 'pairRun'
  | 'plane'
  | 'planeSingles'
  | 'planePairs'
  | 'fourSingles'
  | 'fourPairs'
  | 'bomb'
  | 'straightFlush'
  | 'rocket';

export interface Combo {
  kind: ComboKind;
  /** What it is compared by: the card, the triple, the four, or the top of a straight. */
  rank: number;
  size: number;
}

const countsOf = (cards: readonly LCard[]): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  return counts;
};

/** True if the ranks are `length` in a row starting from `from`, and all are 3 to the ace. */
const inARow = (ranks: readonly number[]): boolean => {
  if (ranks.length === 0) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  if (sorted[0] < 3 || sorted[sorted.length - 1] > ACE) return false;
  return sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
};

const bothJokers = (cards: readonly LCard[]) => cards.some((c) => c.rank === SMALL_JOKER) && cards.some((c) => c.rank === BIG_JOKER);

/** What a set of cards is as a play, or null if it is not a legal play (with the rules switched on or off). */
export function classify(cards: readonly LCard[], options: RuleOptions): Combo | null {
  const n = cards.length;
  if (n === 0) return null;
  const counts = countsOf(cards);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const top = ranks[ranks.length - 1];

  if (n === 1) return { kind: 'single', rank: top, size: 1 };
  if (n === 2) {
    if (bothJokers(cards)) return { kind: 'rocket', rank: BIG_JOKER, size: 2 };
    return ranks.length === 1 ? { kind: 'pair', rank: top, size: 2 } : null;
  }
  if (n === 3) return ranks.length === 1 ? { kind: 'triple', rank: top, size: 3 } : null;
  if (n === 4 && ranks.length === 1) return { kind: 'bomb', rank: top, size: 4 };

  // Straight flush before straight, so a straight of one suit is the stronger thing when that option is on.
  if (options.straightFlush && n >= 5 && ranks.length === n && inARow(ranks) && cards.every((c) => c.suit && c.suit === cards[0].suit)) {
    return { kind: 'straightFlush', rank: top, size: n };
  }
  if (n >= 5 && ranks.length === n && inARow(ranks)) return { kind: 'straight', rank: top, size: n };
  if (options.pairRuns && n >= 6 && n % 2 === 0 && ranks.length === n / 2 && ranks.every((r) => counts.get(r) === 2) && inARow(ranks)) {
    return { kind: 'pairRun', rank: top, size: n };
  }

  const triples = ranks.filter((r) => counts.get(r) === 3);
  if (n === 4 && triples.length === 1) return { kind: 'tripleSingle', rank: triples[0], size: 4 };
  if (n === 5 && triples.length === 1 && ranks.length === 2) return { kind: 'triplePair', rank: triples[0], size: 5 };

  if (options.fourWithTwo) {
    const four = ranks.find((r) => counts.get(r) === 4 && r <= TWO);
    if (four !== undefined) {
      const rest = cards.filter((c) => c.rank !== four);
      if (n === 6 && !bothJokers(rest)) return { kind: 'fourSingles', rank: four, size: 6 };
      const restCounts = countsOf(rest);
      if (n === 8 && restCounts.size === 2 && [...restCounts.values()].every((v) => v === 2)) return { kind: 'fourPairs', rank: four, size: 8 };
    }
  }

  if (options.planes) return classifyPlane(cards, counts);
  return null;
}

/** A run of triples, bare or with one card or one pair for each. The highest reading is the one used. */
function classifyPlane(cards: readonly LCard[], counts: Map<number, number>): Combo | null {
  const n = cards.length;
  const candidates: [number, 'plane' | 'planeSingles' | 'planePairs'][] = [];
  if (n % 3 === 0) candidates.push([n / 3, 'plane']);
  if (n % 4 === 0) candidates.push([n / 4, 'planeSingles']);
  if (n % 5 === 0) candidates.push([n / 5, 'planePairs']);

  for (const [k, kind] of candidates) {
    if (k < 2) continue;
    for (let start = ACE - k + 1; start >= 3; start--) {
      const run = Array.from({ length: k }, (_, i) => start + i);
      if (!run.every((r) => (counts.get(r) ?? 0) >= 3)) continue;
      const rest = new Map(counts);
      for (const r of run) rest.set(r, (rest.get(r) ?? 0) - 3);
      const restCards = [...rest.entries()].filter(([, v]) => v > 0);
      const restTotal = restCards.reduce((sum, [, v]) => sum + v, 0);
      if (kind === 'plane' && restTotal === 0) return { kind, rank: start + k - 1, size: n };
      if (kind === 'planeSingles' && restTotal === k && !(rest.get(SMALL_JOKER) && rest.get(BIG_JOKER))) {
        return { kind, rank: start + k - 1, size: n };
      }
      if (kind === 'planePairs' && restCards.length === k && restCards.every(([r, v]) => v === 2 && r < SMALL_JOKER)) {
        return { kind, rank: start + k - 1, size: n };
      }
    }
  }
  return null;
}

/** Whether `play` may be played on top of `last`. */
export function beats(play: Combo, last: Combo): boolean {
  if (last.kind === 'rocket') return false;
  if (play.kind === 'rocket') return true;
  if (last.kind === 'straightFlush') return play.kind === 'straightFlush' && play.size === last.size && play.rank > last.rank;
  if (play.kind === 'straightFlush') return true;
  if (last.kind === 'bomb') return play.kind === 'bomb' && play.rank > last.rank;
  if (play.kind === 'bomb') return true;
  return play.kind === last.kind && play.size === last.size && play.rank > last.rank;
}

/** A bomb, the rocket or a straight flush doubles the multiplier. */
export const isDoubling = (combo: Combo) => combo.kind === 'bomb' || combo.kind === 'rocket' || combo.kind === 'straightFlush';

// ---- Listing the plays a hand can make

const byRank = (hand: readonly LCard[]): Map<number, LCard[]> => {
  const groups = new Map<number, LCard[]>();
  for (const c of sortHand(hand)) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  return groups;
};

/** Every way to pick `count` cards out of the ranks in `available` (rank -> how many cards of it are free). */
function pickSingles(available: Map<number, LCard[]>, count: number): LCard[][] {
  const ranks = [...available.keys()].sort((a, b) => a - b);
  const out: LCard[][] = [];
  const walk = (index: number, left: number, chosen: LCard[]) => {
    if (left === 0) {
      out.push(chosen);
      return;
    }
    if (index >= ranks.length) return;
    const cards = available.get(ranks[index])!;
    for (let take = Math.min(left, cards.length); take >= 0; take--) walk(index + 1, left - take, [...chosen, ...cards.slice(0, take)]);
  };
  walk(0, count, []);
  return out.filter((cards) => !bothJokers(cards));
}

/** Every way to pick `count` different ranks that each have a pair free, taking two cards of each. */
function pickPairs(available: Map<number, LCard[]>, count: number): LCard[][] {
  const ranks = [...available.keys()].filter((r) => r < SMALL_JOKER && available.get(r)!.length >= 2).sort((a, b) => a - b);
  const out: LCard[][] = [];
  const walk = (index: number, left: number, chosen: LCard[]) => {
    if (left === 0) {
      out.push(chosen);
      return;
    }
    for (let i = index; i < ranks.length; i++) walk(i + 1, left - 1, [...chosen, ...available.get(ranks[i])!.slice(0, 2)]);
  };
  walk(0, count, []);
  return out;
}

/** The cards left free once `taken` ranks have given up `amount` cards each. */
function without(groups: Map<number, LCard[]>, taken: readonly number[], amount: number): Map<number, LCard[]> {
  const rest = new Map<number, LCard[]>();
  for (const [rank, cards] of groups) {
    const left = taken.includes(rank) ? cards.slice(amount) : cards;
    if (left.length > 0) rest.set(rank, left);
  }
  return rest;
}

const runsOf = (ranks: readonly number[], minLength: number): number[][] => {
  const out: number[][] = [];
  const set = new Set(ranks);
  for (let start = 3; start <= ACE; start++) {
    for (let end = start + minLength - 1; end <= ACE; end++) {
      const run = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      if (run.every((r) => set.has(r))) out.push(run);
      else break;
    }
  }
  return out;
};

/**
 * Every play the hand can make (one for each different set of ranks), that beats `last`. With nothing to beat,
 * every legal lead. The cards chosen are the first ones of each rank, so the result is the same for equal hands.
 */
export function legalPlays(hand: readonly LCard[], last: Combo | null, options: RuleOptions): LCard[][] {
  const groups = byRank(hand);
  const have = (min: number) => [...groups.keys()].filter((r) => groups.get(r)!.length >= min && r <= TWO).sort((a, b) => a - b);
  const candidates: LCard[][] = [];
  const take = (rank: number, n: number) => groups.get(rank)!.slice(0, n);

  for (const r of groups.keys()) candidates.push(take(r, 1));
  for (const r of have(2)) candidates.push(take(r, 2));
  for (const r of have(3)) candidates.push(take(r, 3));
  for (const r of have(4)) candidates.push(take(r, 4));
  if (groups.has(SMALL_JOKER) && groups.has(BIG_JOKER)) candidates.push([take(SMALL_JOKER, 1)[0], take(BIG_JOKER, 1)[0]]);

  const straightRanks = [...groups.keys()].filter((r) => r <= ACE);
  for (const run of runsOf(straightRanks, 5)) candidates.push(run.map((r) => take(r, 1)[0]));
  if (options.pairRuns) for (const run of runsOf(have(2).filter((r) => r <= ACE), 3)) candidates.push(run.flatMap((r) => take(r, 2)));

  if (options.straightFlush) {
    for (const suit of SUITS) {
      const ofSuit = hand.filter((c) => c.suit === suit && c.rank <= ACE);
      for (const run of runsOf(ofSuit.map((c) => c.rank), 5)) candidates.push(run.map((r) => ofSuit.find((c) => c.rank === r)!));
    }
  }

  for (const r of have(3)) {
    const rest = without(groups, [r], 3);
    for (const wing of pickSingles(rest, 1)) candidates.push([...take(r, 3), ...wing]);
    for (const wing of pickPairs(rest, 1)) candidates.push([...take(r, 3), ...wing]);
  }

  if (options.planes) {
    for (const run of runsOf(have(3).filter((r) => r <= ACE), 2)) {
      const triples = run.flatMap((r) => take(r, 3));
      const rest = without(groups, run, 3);
      candidates.push(triples);
      for (const wings of pickSingles(rest, run.length)) candidates.push([...triples, ...wings]);
      for (const wings of pickPairs(rest, run.length)) candidates.push([...triples, ...wings]);
    }
  }

  if (options.fourWithTwo) {
    for (const r of have(4)) {
      const rest = without(groups, [r], 4);
      for (const wings of pickSingles(rest, 2)) candidates.push([...take(r, 4), ...wings]);
      for (const wings of pickPairs(rest, 2)) candidates.push([...take(r, 4), ...wings]);
    }
  }

  const seen = new Set<string>();
  const plays: LCard[][] = [];
  for (const cards of candidates) {
    const combo = classify(cards, options);
    if (!combo || (last && !beats(combo, last))) continue;
    const key = `${combo.kind}:${cards.map((c) => c.rank).sort((a, b) => a - b).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plays.push(cards);
  }
  return plays;
}

// ---- Bidding

export interface BidState {
  /** The seat whose turn it is to bid. */
  turn: number;
  /** What each seat bid, 0 for a pass, or null if it has not bid yet. */
  bids: (number | null)[];
  /** The highest bid so far. */
  value: number;
  leader: number | null;
  done: boolean;
  landlord: number | null;
  /** Everybody passed: deal again. */
  redeal: boolean;
}

export const startBidding = (first: number): BidState => ({
  turn: first,
  bids: [null, null, null],
  value: 0,
  leader: null,
  done: false,
  landlord: null,
  redeal: false,
});

export const legalBids = (state: BidState): number[] => (state.done ? [] : [0, ...[1, 2, 3].filter((v) => v > state.value)]);

/** The seat to bid says 0 (pass) or a bid higher than the last. A bid of 3 ends it; so does the third seat speaking. */
export function bid(state: BidState, amount: number): BidState {
  if (!legalBids(state).includes(amount)) return state;
  const bids = [...state.bids];
  bids[state.turn] = amount;
  const value = amount > 0 ? amount : state.value;
  const leader = amount > 0 ? state.turn : state.leader;
  const done = amount === 3 || bids.every((b) => b !== null);
  if (!done) return { ...state, bids, value, leader, turn: (state.turn + 1) % 3 };
  return { ...state, bids, value, leader, done: true, landlord: value === 0 ? null : leader, redeal: value === 0 };
}

// ---- Playing a round

export interface Play {
  seat: number;
  combo: Combo;
  cards: LCard[];
}

export interface Round {
  hands: LCard[][];
  landlord: number;
  /** What the landlord bid: the multiplier to start from. */
  bid: number;
  options: RuleOptions;
  turn: number;
  /** The play to beat. Null when the seat to play is leading. */
  last: Play | null;
  passes: number;
  /** How many times each seat has played (not passed). Used for springs. */
  plays: [number, number, number];
  /** How many bombs, rockets and straight flushes have been played. */
  doublings: number;
  /** The seat that played its last card, or the side that won when someone gave up. */
  winner: number | null;
  forfeitedBy: number | null;
}

export function startRound(hands: readonly (readonly LCard[])[], bottom: readonly LCard[], landlord: number, bidValue: number, options: RuleOptions): Round {
  const dealt = hands.map((h, seat) => (seat === landlord ? sortHand([...h, ...bottom]) : sortHand(h)));
  return { hands: dealt, landlord, bid: bidValue, options, turn: landlord, last: null, passes: 0, plays: [0, 0, 0], doublings: 0, winner: null, forfeitedBy: null };
}

/** The seat plays these cards. Anything that is not allowed leaves the round as it is. */
export function play(round: Round, cards: readonly LCard[]): Round {
  if (round.winner !== null) return round;
  const seat = round.turn;
  const hand = round.hands[seat];
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== cards.length || !cards.every((c) => hand.some((h) => h.id === c.id))) return round;
  const combo = classify(cards, round.options);
  if (!combo || (round.last && !beats(combo, round.last.combo))) return round;

  const left = hand.filter((c) => !ids.has(c.id));
  const hands = round.hands.map((h, i) => (i === seat ? left : h));
  const plays = [...round.plays] as [number, number, number];
  plays[seat]++;
  return {
    ...round,
    hands,
    last: { seat, combo, cards: [...cards] },
    passes: 0,
    plays,
    doublings: round.doublings + (isDoubling(combo) ? 1 : 0),
    winner: left.length === 0 ? seat : null,
    turn: left.length === 0 ? seat : (seat + 1) % 3,
  };
}

/** The seat passes. Not allowed when leading. After two passes the last player to play leads again. */
export function pass(round: Round): Round {
  if (round.winner !== null || round.last === null) return round;
  const passes = round.passes + 1;
  if (passes < 2) return { ...round, passes, turn: (round.turn + 1) % 3 };
  return { ...round, passes: 0, turn: round.last.seat, last: null };
}

/** The seat gives up. Its side loses. */
export function forfeitRound(round: Round, seat: number): Round {
  if (round.winner !== null) return round;
  const winner = seat === round.landlord ? (round.landlord + 1) % 3 : round.landlord;
  return { ...round, winner, forfeitedBy: seat };
}

const landlordWon = (round: Round) => round.winner === round.landlord;

/**
 * The bid, doubled for each bomb, rocket or straight flush, and once more for a spring: the landlord wins before
 * either peasant has played, or the peasants win while the landlord has played only once. No spring when someone
 * gave up. There is no upper limit.
 */
export function multiplierOf(round: Round): number {
  let multiplier = round.bid * 2 ** round.doublings;
  if (round.winner !== null && round.forfeitedBy === null) {
    const spring = landlordWon(round) ? round.plays[(round.landlord + 1) % 3] + round.plays[(round.landlord + 2) % 3] === 0 : round.plays[round.landlord] <= 1;
    if (spring) multiplier *= 2;
  }
  return multiplier;
}

export interface Score {
  won: boolean;
  multiplier: number;
  /** Coins to pay back to the player: their bet and what they won. Zero after a loss. */
  returned: number;
  /** What a loss costs on top of the bet: a half of the multiplier for a peasant, a quarter for the landlord. */
  extraLoss: number;
}

/** How a finished round came out for the player in `seat`, who staked `bet` coins at the start. */
export function scoreRound(round: Round, bet: number, seat: number): Score {
  if (round.winner === null) throw new Error('The round is not over');
  const multiplier = multiplierOf(round);
  const isLandlord = seat === round.landlord;
  const won = isLandlord === landlordWon(round);
  if (won) return { won, multiplier, returned: bet + bet * multiplier * (isLandlord ? 2 : 1), extraLoss: 0 };
  return { won, multiplier, returned: 0, extraLoss: Math.floor((bet * multiplier) / (isLandlord ? 4 : 2)) };
}
