import { SUIT_SYMBOL, newDeck, rankLabel, type Card } from '../cards';

/** Standard American Gin Rummy, as played in tournaments: a match runs to 100 points over several hands. */
export const HAND_SIZE = 10;
/** You may knock when the cards left over (deadwood) add up to this many points or fewer. */
export const KNOCK_LIMIT = 10;
export const MATCH_TARGET = 100;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
/** Added to the winner of the match. */
export const MATCH_BONUS = 100;
/** Added for every hand a player won, once the match is over. */
export const HAND_BONUS = 20;
/** Profit per coin staked for winning the match. */
export const WIN_PAYOUT = 1;
/** The hand is a draw if this few cards (or fewer) are left in the stock after a discard. */
export const STOCK_FLOOR = 2;

export type Who = 'player' | 'bot';
export const other = (who: Who): Who => (who === 'player' ? 'bot' : 'player');

/** Aces are 1, face cards are 10. */
export const deadwoodValue = (card: Card) => Math.min(card.rank, 10);
const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
export const cardName = (card: Card) => `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
const bySuitThenRank = (a: Card, b: Card) => a.suit.localeCompare(b.suit) || a.rank - b.rank;
const byRankThenSuit = (a: Card, b: Card) => a.rank - b.rank || a.suit.localeCompare(b.suit);

// ---------------------------------------------------------------- melds

/** A set is 3 or 4 cards of one rank. A run is 3 or more in a row of one suit. Aces are low only (no K-A-2). */
const isSet = (meld: readonly Card[]) => meld.every((c) => c.rank === meld[0].rank);

/** Every set and run that can be made from `hand`, as lists of positions in the hand. */
function candidateMelds(hand: readonly Card[]): number[][] {
  const melds: number[][] = [];

  const byRank = new Map<number, number[]>();
  hand.forEach((card, i) => byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), i]));
  for (const group of byRank.values()) {
    if (group.length < 3) continue;
    if (group.length === 3) melds.push(group);
    else {
      for (let skip = 0; skip < 4; skip++) melds.push(group.filter((_, k) => k !== skip));
      melds.push(group);
    }
  }

  const bySuit = new Map<string, number[]>();
  hand.forEach((card, i) => bySuit.set(card.suit, [...(bySuit.get(card.suit) ?? []), i]));
  for (const group of bySuit.values()) {
    const sorted = [...group].sort((a, b) => hand[a].rank - hand[b].rank);
    for (let start = 0; start < sorted.length; start++) {
      let end = start;
      while (end + 1 < sorted.length && hand[sorted[end + 1]].rank === hand[sorted[end]].rank + 1) {
        end++;
        if (end - start >= 2) melds.push(sorted.slice(start, end + 1));
      }
    }
  }
  return melds;
}

export interface Arrangement {
  melds: Card[][];
  deadwood: Card[];
  /** The deadwood total. */
  points: number;
}

/** Splits a hand into the sets and runs that leave the fewest deadwood points. */
export function arrange(hand: readonly Card[]): Arrangement {
  const n = hand.length;
  const melds = candidateMelds(hand);
  const masks = melds.map((m) => m.reduce((mask, i) => mask | (1 << i), 0));
  const full = (1 << n) - 1;
  const memo = new Map<number, { points: number; picks: number[] }>();

  const solve = (used: number): { points: number; picks: number[] } => {
    if (used === full) return { points: 0, picks: [] };
    const cached = memo.get(used);
    if (cached) return cached;
    let i = 0;
    while (used & (1 << i)) i++;
    // Either this card stays unmatched...
    const leave = solve(used | (1 << i));
    let best = { points: leave.points + deadwoodValue(hand[i]), picks: leave.picks };
    // ...or it goes into one of the melds that contains it.
    masks.forEach((mask, k) => {
      if (!(mask & (1 << i)) || mask & used) return;
      const r = solve(used | mask);
      if (r.points < best.points) best = { points: r.points, picks: [k, ...r.picks] };
    });
    memo.set(used, best);
    return best;
  };

  const { points, picks } = solve(0);
  const inMeld = new Set<number>();
  const chosen = picks.map((k) => {
    melds[k].forEach((i) => inMeld.add(i));
    return sortMeld(melds[k].map((i) => hand[i]));
  });
  const deadwood = hand.filter((_, i) => !inMeld.has(i)).sort(byRankThenSuit);
  chosen.sort((a, b) => byRankThenSuit(a[0], b[0]));
  return { melds: chosen, deadwood, points };
}

const sortMeld = (meld: Card[]) => [...meld].sort(isSet(meld) ? bySuitThenRank : byRankThenSuit);

export const deadwoodPoints = (hand: readonly Card[]) => arrange(hand).points;

/** Can `card` be added to this set or run? A set holds at most 4 cards, a run grows at either end. */
export function canAttach(meld: readonly Card[], card: Card): boolean {
  if (isSet(meld)) return meld.length < 4 && card.rank === meld[0].rank;
  if (card.suit !== meld[0].suit) return false;
  const ranks = meld.map((c) => c.rank);
  return card.rank === Math.min(...ranks) - 1 || card.rank === Math.max(...ranks) + 1;
}

const attach = (meld: Card[], card: Card): Card[] => sortMeld([...meld, card]);

/** Tries to add every card in `cards` to the melds, in some order. Returns the new melds, or null if it can't. */
function attachAll(melds: Card[][], cards: Card[]): Card[][] | null {
  if (cards.length === 0) return melds;
  // Any card that fits somewhere can go first: which one goes first never matters, only where it goes.
  const index = cards.findIndex((c) => melds.some((m) => canAttach(m, c)));
  if (index < 0) return null;
  const card = cards[index];
  const rest = cards.filter((_, i) => i !== index);
  for (let k = 0; k < melds.length; k++) {
    if (!canAttach(melds[k], card)) continue;
    const next = melds.map((m, j) => (j === k ? attach(m, card) : m));
    const done = attachAll(next, rest);
    if (done) return done;
  }
  return null;
}

export interface Layoff {
  /** The cards added to the knocker's melds. */
  laidOff: Card[];
  /** The knocker's melds with those cards added. */
  knockerMelds: Card[][];
  /** What the other player is left with. */
  remaining: Arrangement;
}

/**
 * After a knock the other player may add cards to the knocker's sets and runs. This finds the choice that
 * leaves them the fewest deadwood points. Laying off is never worse, so ties lay off as many as possible.
 */
export function bestLayoff(hand: readonly Card[], knockerMelds: Card[][]): Layoff {
  // Which cards could be laid off at all, counting cards that only fit after another one was added.
  let melds = knockerMelds;
  const candidates: Card[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const card of hand) {
      if (candidates.some((c) => sameCard(c, card))) continue;
      const k = melds.findIndex((m) => canAttach(m, card));
      if (k < 0) continue;
      melds = melds.map((m, j) => (j === k ? attach(m, card) : m));
      candidates.push(card);
      changed = true;
    }
  }

  let best: Layoff = { laidOff: [], knockerMelds, remaining: arrange(hand) };
  for (let subset = 1; subset < 1 << candidates.length; subset++) {
    const chosen = candidates.filter((_, i) => subset & (1 << i));
    const placed = attachAll(knockerMelds, chosen);
    if (!placed) continue;
    const remaining = arrange(hand.filter((c) => !chosen.some((x) => sameCard(x, c))));
    if (remaining.points < best.remaining.points || (remaining.points === best.remaining.points && chosen.length > best.laidOff.length)) {
      best = { laidOff: chosen, knockerMelds: placed, remaining };
    }
  }
  return best;
}

// ---------------------------------------------------------------- one hand

export type Phase = 'offer' | 'draw' | 'discard' | 'over';

export interface HandResult {
  kind: 'knock' | 'gin' | 'undercut' | 'draw';
  /** Who scored. Null for a draw. */
  winner: Who | null;
  knocker?: Who;
  /** The knocker's melds, after the other player's layoffs. */
  knockerMelds?: Card[][];
  knockerDeadwood?: Card[];
  knockerPoints?: number;
  /** The other player's melds, deadwood and total once any layoffs are taken off. */
  otherMelds?: Card[][];
  otherDeadwood?: Card[];
  otherPoints?: number;
  laidOff?: Card[];
  /** What the winner scored for the hand, bonus included. */
  points: number;
  /** The gin or undercut bonus part of `points`. */
  bonus: number;
}

export interface GinHand {
  /** The next card is stock[0]. */
  stock: Card[];
  /** The last card is on top. Everything ever discarded stays here, so the bot can remember it. */
  discard: Card[];
  player: Card[];
  bot: Card[];
  dealer: Who;
  turn: Who;
  phase: Phase;
  /** At the start, how many players have passed on the first up card. Two means the stock must be drawn from. */
  passes: number;
  /** The card just picked up from the pile. It can't go straight back. */
  taken: Card | null;
  /** Cards the player has picked up from the pile, which tell the bot what the player is collecting. */
  playerTook: Card[];
  result: HandResult | null;
  /** A short description of the last move, for the screen. */
  log: string;
}

/** Deals 10 cards each, alternating from the player who isn't dealing, then turns up the first card. */
export function dealHand(deck: readonly Card[], dealer: Who): GinHand {
  const stock = [...deck];
  const first = other(dealer);
  const hands: Record<Who, Card[]> = { player: [], bot: [] };
  for (let i = 0; i < HAND_SIZE; i++) {
    hands[first].push(stock.shift()!);
    hands[dealer].push(stock.shift()!);
  }
  const up = stock.shift()!;
  return {
    stock,
    discard: [up],
    player: hands.player,
    bot: hands.bot,
    dealer,
    turn: first,
    phase: 'offer',
    passes: 0,
    taken: null,
    playerTook: [],
    result: null,
    log: `${first === 'player' ? 'You are' : 'Bot is'} first to act. The ${cardName(up)} is turned up.`,
  };
}

export const topDiscard = (h: GinHand) => h.discard[h.discard.length - 1];
const subject = (who: Who) => (who === 'player' ? 'You' : 'Bot');

/** True when the player on turn must draw from the stock, because both passed the first card. */
export const mustDrawStock = (h: GinHand) => h.phase === 'draw' && h.passes >= 2;

function withHand(h: GinHand, who: Who, hand: Card[]): GinHand {
  return { ...h, [who]: hand };
}

/** At the start, picks up the first card instead of passing. */
export function takeUpcard(h: GinHand): GinHand {
  if (h.phase !== 'offer') return h;
  return takeFromPile(h);
}

/** At the start, passes on the first card. When both pass, the player who went first must draw from the stock. */
export function passUpcard(h: GinHand): GinHand {
  if (h.phase !== 'offer') return h;
  const passes = h.passes + 1;
  const log = `${subject(h.turn)} passed on the ${cardName(topDiscard(h))}.`;
  if (passes === 1) return { ...h, passes, turn: other(h.turn), log };
  return { ...h, passes, turn: other(h.turn), phase: 'draw', log: `${log} Nobody wanted it.` };
}

function takeFromPile(h: GinHand): GinHand {
  const card = topDiscard(h);
  const next = withHand(h, h.turn, [...h[h.turn], card]);
  return {
    ...next,
    discard: h.discard.slice(0, -1),
    phase: 'discard',
    passes: 0,
    taken: card,
    playerTook: h.turn === 'player' ? [...h.playerTook, card] : h.playerTook,
    log: `${subject(h.turn)} took the ${cardName(card)}${h.turn === 'bot' ? ' from the pile' : ''}.`,
  };
}

export function drawFromPile(h: GinHand): GinHand {
  if (h.phase !== 'draw' || mustDrawStock(h)) return h;
  return takeFromPile(h);
}

export function drawFromStock(h: GinHand): GinHand {
  if (h.phase !== 'draw') return h;
  const [card, ...stock] = h.stock;
  return {
    ...withHand(h, h.turn, [...h[h.turn], card]),
    stock,
    phase: 'discard',
    passes: 0,
    taken: null,
    log: `${subject(h.turn)} drew from the stock.`,
  };
}

/** The positions in the hand that may be discarded: any card except the one just taken from the pile. */
export function discardable(h: GinHand, hand: readonly Card[]): number[] {
  return hand.map((_, i) => i).filter((i) => !h.taken || !sameCard(hand[i], h.taken));
}

/** Discards the card at `index` for whoever's turn it is. A hand with 2 cards left in the stock is a draw. */
export function discardCard(h: GinHand, index: number): GinHand {
  if (h.phase !== 'discard') return h;
  const hand = h[h.turn];
  const card = hand[index];
  if (!card || !discardable(h, hand).includes(index)) return h;
  const next: GinHand = {
    ...withHand(h, h.turn, hand.filter((_, i) => i !== index)),
    discard: [...h.discard, card],
    taken: null,
    log: `${subject(h.turn)} discarded the ${cardName(card)}.`,
  };
  if (next.stock.length <= STOCK_FLOOR) {
    return { ...next, phase: 'over', result: { kind: 'draw', winner: null, points: 0, bonus: 0 }, log: `${next.log} Only ${next.stock.length} cards are left in the stock, so the hand is a draw.` };
  }
  return { ...next, turn: other(h.turn), phase: 'draw' };
}

/** Whether discarding the card at `index` leaves a hand you may knock with, and what it would leave. */
export function knockOption(h: GinHand, index: number): { allowed: boolean; points: number } {
  const hand = h[h.turn];
  if (h.phase !== 'discard' || !discardable(h, hand).includes(index)) return { allowed: false, points: 0 };
  const points = deadwoodPoints(hand.filter((_, i) => i !== index));
  return { allowed: points <= KNOCK_LIMIT, points };
}

/** Discards the card at `index` and knocks (or goes gin, with no deadwood), then settles the hand. */
export function knock(h: GinHand, index: number): GinHand {
  if (!knockOption(h, index).allowed) return h;
  const knocker = h.turn;
  const card = h[knocker][index];
  const hand = h[knocker].filter((_, i) => i !== index);
  const mine = arrange(hand);
  const theirs = h[other(knocker)];
  const base: GinHand = { ...withHand(h, knocker, hand), discard: [...h.discard, card], taken: null, phase: 'over' };

  // Gin: no deadwood at all. The other player can't lay off against it.
  if (mine.points === 0) {
    const against = arrange(theirs);
    const result: HandResult = {
      kind: 'gin',
      winner: knocker,
      knocker,
      knockerMelds: mine.melds,
      knockerDeadwood: [],
      knockerPoints: 0,
      otherMelds: against.melds,
      otherDeadwood: against.deadwood,
      otherPoints: against.points,
      laidOff: [],
      points: against.points + GIN_BONUS,
      bonus: GIN_BONUS,
    };
    return { ...base, result, log: `${subject(knocker)} went gin!` };
  }

  const layoff = bestLayoff(theirs, mine.melds);
  const k = mine.points;
  const o = layoff.remaining.points;
  const undercut = o <= k;
  const result: HandResult = {
    kind: undercut ? 'undercut' : 'knock',
    winner: undercut ? other(knocker) : knocker,
    knocker,
    knockerMelds: layoff.knockerMelds,
    knockerDeadwood: mine.deadwood,
    knockerPoints: k,
    otherMelds: layoff.remaining.melds,
    otherDeadwood: layoff.remaining.deadwood,
    otherPoints: o,
    laidOff: layoff.laidOff,
    points: undercut ? k - o + UNDERCUT_BONUS : o - k,
    bonus: undercut ? UNDERCUT_BONUS : 0,
  };
  return { ...base, result, log: `${subject(knocker)} knocked with ${k}.` };
}

// ---------------------------------------------------------------- a match

export interface GinMatch {
  bet: number;
  scores: Record<Who, number>;
  handsWon: Record<Who, number>;
  handNumber: number;
  hand: GinHand;
  /** 'won' or 'lost' once someone reaches the target, or when the player forfeits. */
  status: 'playing' | 'won' | 'lost';
  /** Final scores with the match and hand bonuses added. Set when the match ends by points. */
  final: Record<Who, number> | null;
  forfeited: boolean;
}

export function startMatch(deck: readonly Card[], bet: number, dealer: Who): GinMatch {
  return {
    bet,
    scores: { player: 0, bot: 0 },
    handsWon: { player: 0, bot: 0 },
    handNumber: 1,
    hand: dealHand(deck, dealer),
    status: 'playing',
    final: null,
    forfeited: false,
  };
}

export const finalScores = (scores: Record<Who, number>, handsWon: Record<Who, number>, winner: Who): Record<Who, number> => ({
  player: scores.player + handsWon.player * HAND_BONUS + (winner === 'player' ? MATCH_BONUS : 0),
  bot: scores.bot + handsWon.bot * HAND_BONUS + (winner === 'bot' ? MATCH_BONUS : 0),
});

/** Puts a changed hand into the match. If that ended the hand, the score is added up and the match may end. */
export function updateHand(m: GinMatch, hand: GinHand): GinMatch {
  if (hand === m.hand) return m;
  const next = { ...m, hand };
  if (m.hand.phase === 'over' || hand.phase !== 'over' || !hand.result) return next;

  const { winner, points } = hand.result;
  if (!winner) return next;
  const scores = { ...m.scores, [winner]: m.scores[winner] + points };
  const handsWon = { ...m.handsWon, [winner]: m.handsWon[winner] + 1 };
  const ended = scores[winner] >= MATCH_TARGET;
  return {
    ...next,
    scores,
    handsWon,
    status: ended ? (winner === 'player' ? 'won' : 'lost') : 'playing',
    final: ended ? finalScores(scores, handsWon, winner) : null,
  };
}

/** Deals the next hand, with the other player dealing. */
export function nextHand(m: GinMatch, deck: readonly Card[]): GinMatch {
  if (m.status !== 'playing' || m.hand.phase !== 'over') return m;
  return { ...m, handNumber: m.handNumber + 1, hand: dealHand(deck, other(m.hand.dealer)) };
}

export const forfeit = (m: GinMatch): GinMatch => (m.status === 'playing' ? { ...m, status: 'lost', forfeited: true } : m);

/** Coins handed back, including the stake. */
export const returnedFor = (m: GinMatch): number => (m.status === 'won' ? m.bet * (1 + WIN_PAYOUT) : 0);

/** The cards nobody can see from the bot's side: the whole deck except its own hand and the pile. */
export function unseenCards(h: GinHand, hand: readonly Card[]): Card[] {
  return newDeck().filter((c) => !hand.some((x) => sameCard(x, c)) && !h.discard.some((x) => sameCard(x, c)));
}
