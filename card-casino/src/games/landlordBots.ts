import {
  ACE,
  BIG_JOKER,
  SMALL_JOKER,
  TWO,
  classify,
  isDoubling,
  legalPlays,
  type Combo,
  type LCard,
  type Round,
  type RuleOptions,
} from './landlordRules';

/*
 * The bots in Landlord. They play fair: each one looks only at its own hand, the cards already played, the play on the
 * table and how many cards everyone else holds (which is on show at the table). They never peek at another hand and
 * never bluff. The peasants work as a team; the landlord plays alone.
 */

// ---- Counting a hand

const countRanks = (hand: readonly LCard[]): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  return counts;
};

/**
 * A rough count of the turns a hand needs to empty, if it could always lead: the rocket and each bomb are one turn,
 * runs are one turn, a triple takes a spare card or pair along with it, and what is left is a turn for each pair or
 * single. It is a guess to steer the bots, not the true minimum.
 */
export function turnsToEmpty(hand: readonly LCard[], options: RuleOptions): number {
  const counts = countRanks(hand);
  let turns = 0;
  const take = (rank: number, n: number) => {
    const left = (counts.get(rank) ?? 0) - n;
    if (left > 0) counts.set(rank, left);
    else counts.delete(rank);
  };

  if (counts.has(SMALL_JOKER) && counts.has(BIG_JOKER)) {
    take(SMALL_JOKER, 1);
    take(BIG_JOKER, 1);
    turns++;
  }
  for (const [rank, n] of [...counts]) {
    if (n === 4) {
      take(rank, 4);
      turns++;
    }
  }

  /** Takes the longest run of ranks 3 to the ace that has at least `need` of each, one run at a time. */
  const takeRuns = (need: number, minLength: number) => {
    for (;;) {
      let best: number[] = [];
      let run: number[] = [];
      for (let r = 3; r <= ACE + 1; r++) {
        if (r <= ACE && (counts.get(r) ?? 0) >= need) run.push(r);
        else {
          if (run.length > best.length) best = run;
          run = [];
        }
      }
      if (best.length < minLength) return;
      for (const r of best) take(r, need);
      turns++;
    }
  };
  if (options.planes) takeRuns(3, 2);
  if (options.pairRuns) takeRuns(2, 3);
  takeRuns(1, 5);

  // Triples, each with a spare single if there is one, else a spare pair.
  for (const [rank, n] of [...counts]) {
    if (n !== 3) continue;
    take(rank, 3);
    turns++;
    const single = [...counts].find(([, c]) => c === 1);
    if (single) take(single[0], 1);
    else {
      const pair = [...counts].find(([, c]) => c === 2);
      if (pair) take(pair[0], 2);
    }
  }

  for (const [, n] of counts) turns += n >= 3 ? 1 + (n - 3) : 1;
  return turns;
}

// ---- Bidding

/**
 * Points for the strong cards: the rocket, bombs, 2s and jokers, and a little for aces and kings. A bid is only made
 * if it would beat what has been bid, so the answer is always a pass or a legal bid.
 */
export function botBid(hand: readonly LCard[], highest: number): number {
  const counts = countRanks(hand);
  let score = 0;
  if (counts.has(SMALL_JOKER) && counts.has(BIG_JOKER)) score += 3;
  else if (counts.has(SMALL_JOKER) || counts.has(BIG_JOKER)) score += 1;
  for (const [rank, n] of counts) {
    if (rank === TWO) score += n;
    else if (rank === ACE || rank === 13) score += n * 0.5;
    if (n === 4) score += 2;
  }
  const want = score >= 7 ? 3 : score >= 5 ? 2 : score >= 3 ? 1 : 0;
  return want > highest ? want : 0;
}

// ---- Playing

interface Option {
  cards: LCard[];
  combo: Combo;
}

/** True if this play splits up a bomb or the rocket that the hand holds. */
function breaksUp(hand: readonly LCard[], cards: readonly LCard[], combo: Combo): boolean {
  if (isDoubling(combo)) return false;
  const have = countRanks(hand);
  const used = countRanks(cards);
  if (have.has(SMALL_JOKER) && have.has(BIG_JOKER) && (used.has(SMALL_JOKER) || used.has(BIG_JOKER))) return true;
  for (const [rank, n] of used) if ((have.get(rank) ?? 0) === 4 && n < 4) return true;
  return false;
}

/** The seats that are against this one: both others for the landlord, only the landlord for a peasant. */
const opponentsOf = (round: Round, seat: number): number[] =>
  seat === round.landlord ? [0, 1, 2].filter((s) => s !== seat) : [round.landlord];

const without = (hand: readonly LCard[], cards: readonly LCard[]): LCard[] => {
  const ids = new Set(cards.map((c) => c.id));
  return hand.filter((c) => !ids.has(c.id));
};

/**
 * What this seat plays, or null to pass. Null too when it is not this seat's turn. It goes out when it can; otherwise
 * it leads what clears its hand fastest and keeps its bombs, beats a play with the lowest card that does, leaves a
 * partner's winning play alone, and bombs only to stop an opponent who is nearly out.
 */
export function botPlay(round: Round, seat: number): LCard[] | null {
  if (round.winner !== null || round.turn !== seat) return null;
  const hand = round.hands[seat];
  const options = round.options;
  const plays: Option[] = legalPlays(hand, round.last?.combo ?? null, options).flatMap((cards) => {
    const combo = classify(cards, options);
    return combo ? [{ cards, combo }] : [];
  });

  const out = plays.find((p) => p.cards.length === hand.length);
  if (out) return out.cards;
  if (plays.length === 0) return null;

  const opponents = opponentsOf(round, seat);
  const quiet = plays.filter((p) => !isDoubling(p.combo) && !breaksUp(hand, p.cards, p.combo));
  const turnsAfter = (p: Option) => turnsToEmpty(without(hand, p.cards), options);
  const best = (list: Option[], by: (p: Option) => number[]): Option =>
    list.reduce((a, b) => {
      const x = by(a);
      const y = by(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? a : b;
      return a;
    });

  if (round.last === null) {
    // Leading.
    let choices = quiet.length > 0 ? quiet : plays.filter((p) => !isDoubling(p.combo));
    if (choices.length === 0) choices = plays;
    if (opponents.some((o) => round.hands[o].length === 1)) {
      // An opponent could go out on a single: do not lead one that they can beat if there is anything else to lead.
      const others = choices.filter((p) => p.combo.kind !== 'single');
      if (others.length > 0) choices = others;
      else return best(choices, (p) => [-p.combo.rank]).cards;
    }
    return best(choices, (p) => [turnsAfter(p), p.combo.rank, -p.cards.length]).cards;
  }

  // Following. A peasant leaves a partner's play alone.
  const partnerPlayed = seat !== round.landlord && round.last.seat !== round.landlord;
  if (partnerPlayed) return null;
  if (quiet.length > 0) return best(quiet, (p) => [p.combo.rank, turnsAfter(p)]).cards;

  // Only bombs can beat it: worth it only when an opponent is nearly out.
  const bombs = plays.filter((p) => isDoubling(p.combo));
  if (bombs.length > 0 && opponents.some((o) => round.hands[o].length <= 2)) {
    const order = { bomb: 0, straightFlush: 1, rocket: 2 } as Record<string, number>;
    return best(bombs, (p) => [order[p.combo.kind] ?? 3, p.combo.rank]).cards;
  }
  return null;
}
