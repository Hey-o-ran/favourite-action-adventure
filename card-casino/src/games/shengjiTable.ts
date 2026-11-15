import {
  analyze,
  checkFollow,
  checkThrow,
  domainOf,
  isThrow,
  isTrump,
  legalFollow,
  pointsOf,
  positionOf,
  trickWinner,
  type Play,
  type SCard,
  type Trump,
} from './shengjiCards';
import {
  KITTY_SIZE,
  attackerScore,
  deal,
  handLevel,
  kittyMultiplier,
  kittyPointsOf,
  outcomeFor,
  payoutMultiple,
  teamOf,
  trumpFromKitty,
  type HandOutcome,
  type Standing,
} from './shengjiScoring';

/*
 * One hand of Shengji from the deal to the last trick. Seat 0 is the player, 2 is their partner, and 1 and 3 are the
 * opponents, going clockwise. This is the state of the table and the moves that change it.
 * (Declaring trump during the deal and choosing the kitty yourself come later: for now the kitty decides the trump suit
 * and the declarer buries their cheapest cards.)
 */

export interface HandResult {
  /** What the attackers scored: their trick points plus the kitty bonus. */
  attackerScore: number;
  kittyPoints: number;
  /** The extra the attackers got from the kitty for taking the last trick. 0 if they did not. */
  kittyBonus: number;
  outcome: HandOutcome;
  /** The side that won the hand: 0 is seats 0 and 2 (the player's side), 1 is seats 1 and 3. */
  winningTeam: 0 | 1;
}

export interface HandState {
  standing: Standing;
  trump: Trump;
  declarer: number;
  hands: SCard[][];
  /** The 8 buried cards. They count for the attackers if the attackers win the last trick. */
  kitty: SCard[];
  /** Whose turn it is to play. */
  turn: number;
  /** The cards played so far in this trick, in order. The first one is the lead. */
  trick: Play[];
  /** The trick before, and who took it, so a screen can show it. */
  lastTrick: { plays: Play[]; winner: number } | null;
  /** Points each side has won in tricks so far. */
  attackerPoints: number;
  defenderPoints: number;
  tricksPlayed: number;
  phase: 'playing' | 'over';
  result: HandResult | null;
  /** A short description of what has just happened, for the screen. */
  log: string;
}

export const attackingTeam = (s: Pick<HandState, 'declarer'>) => 1 - teamOf(s.declarer);

/** Picks the 8 cards to bury: the cheapest ones, keeping trumps and points. */
function cheapestEight(cards: readonly SCard[], t: Trump): SCard[] {
  return [...cards]
    .sort((a, b) => Number(isTrump(a, t)) - Number(isTrump(b, t)) || pointsOf(a) - pointsOf(b) || positionOf(a, t) - positionOf(b, t) || a.id - b.id)
    .slice(0, KITTY_SIZE);
}

/** Deals a hand. The declarer deals first, the kitty names the trump suit, and the declarer buries 8 cards. */
export function startHand(deck: readonly SCard[], standing: Standing): HandState {
  const level = handLevel(standing);
  const { hands: dealt, kitty: found } = deal(deck, standing.declarer);
  const trump: Trump = { level, suit: trumpFromKitty(found, level) };
  const hands = dealt.map((h) => [...h]);
  const all = [...hands[standing.declarer], ...found];
  const buried = cheapestEight(all, trump);
  hands[standing.declarer] = all.filter((c) => !buried.some((b) => b.id === c.id));
  return {
    standing,
    trump,
    declarer: standing.declarer,
    hands,
    kitty: buried,
    turn: standing.declarer,
    trick: [],
    lastTrick: null,
    attackerPoints: 0,
    defenderPoints: 0,
    tricksPlayed: 0,
    phase: 'playing',
    result: null,
    log: '',
  };
}

export type PlayOutcome = { ok: true; state: HandState } | { ok: false; error: string };

const withoutCards = (hand: readonly SCard[], played: readonly SCard[]) => hand.filter((c) => !played.some((p) => p.id === c.id));

/** The player to the left and right of `seat`, who are on the other side. */
const opponentsOf = (seat: number) => [(seat + 1) % 4, (seat + 3) % 4];

/**
 * Plays cards for `seat`. Returns the new state, or the reason the play is not allowed.
 * A throw that an opponent could beat is not refused: only its weakest piece is played, as the rules say.
 */
export function playCards(state: HandState, seat: number, cards: readonly SCard[]): PlayOutcome {
  if (state.phase !== 'playing') return { ok: false, error: 'The hand is over' };
  if (seat !== state.turn) return { ok: false, error: 'It is not your turn' };
  if (cards.length === 0) return { ok: false, error: 'Choose some cards to play' };
  const hand = state.hands[seat];
  if (!cards.every((c) => hand.some((h) => h.id === c.id)) || new Set(cards.map((c) => c.id)).size !== cards.length) {
    return { ok: false, error: 'Those cards are not in the hand' };
  }

  let played = [...cards];
  let log = '';
  if (state.trick.length === 0) {
    const lead = analyze(played, state.trump);
    if (lead.domain === null) return { ok: false, error: 'Lead cards from one suit, or all trumps' };
    if (isThrow(lead)) {
      const check = checkThrow(lead.combos, opponentsOf(seat).map((s) => state.hands[s]), state.trump);
      if (!check.ok) {
        played = [...check.forced.cards];
        log = 'The throw was beaten, so only its weakest part was played.';
      }
    }
  } else {
    const error = checkFollow(hand, played, analyze(state.trick[0].cards, state.trump), state.trump);
    if (error) return { ok: false, error };
  }

  const hands = state.hands.map((h, s) => (s === seat ? withoutCards(h, played) : h));
  const trick: Play[] = [...state.trick, { seat, cards: played }];
  const next: HandState = { ...state, hands, trick, log };
  if (trick.length < 4) return { ok: true, state: { ...next, turn: (seat + 1) % 4 } };
  return { ok: true, state: finishTrick(next) };
}

function finishTrick(state: HandState): HandState {
  const winner = trickWinner(state.trick, state.trump);
  const won = state.trick.flatMap((p) => p.cards).reduce((n, c) => n + pointsOf(c), 0);
  const attackersTookIt = teamOf(winner) === attackingTeam(state);
  const attackerPoints = state.attackerPoints + (attackersTookIt ? won : 0);
  const defenderPoints = state.defenderPoints + (attackersTookIt ? 0 : won);
  const next: HandState = {
    ...state,
    trick: [],
    lastTrick: { plays: state.trick, winner },
    attackerPoints,
    defenderPoints,
    tricksPlayed: state.tricksPlayed + 1,
    turn: winner,
  };
  if (state.hands.some((h) => h.length > 0)) return next;

  // That was the last trick: the kitty goes to whoever won it, multiplied if it was the attackers.
  const winningPlay = state.trick.find((p) => p.seat === winner)!;
  const kittyPoints = kittyPointsOf(state.kitty);
  const kittyBonus = attackersTookIt ? kittyPoints * kittyMultiplier(winningPlay.cards, state.trump) : 0;
  const score = attackerScore({ trickPoints: attackerPoints, kittyPoints, attackersWonLast: attackersTookIt, multiplier: kittyMultiplier(winningPlay.cards, state.trump) });
  const outcome = outcomeFor(score);
  const winningTeam = (outcome.winner === 'defenders' ? teamOf(state.declarer) : attackingTeam(state)) as 0 | 1;
  return { ...next, phase: 'over', result: { attackerScore: score, kittyPoints, kittyBonus, outcome, winningTeam } };
}

/** What a hand pays the player per coin bet, stake included: nothing if their side lost. */
export const payoutFor = (result: HandResult): number => (result.winningTeam === teamOf(0) ? payoutMultiple(result.outcome.levels) : 0);

/**
 * A simple bot: it leads its cheapest plain card (or trump if it has no other), and follows with the cheapest legal play.
 * It always makes a legal play, but does not try to win points yet.
 */
export function botCards(state: HandState): SCard[] {
  const hand = state.hands[state.turn];
  const t = state.trump;
  if (state.trick.length > 0) return legalFollow(hand, analyze(state.trick[0].cards, t), t);
  const cheap = (a: SCard, b: SCard) => pointsOf(a) - pointsOf(b) || positionOf(a, t) - positionOf(b, t) || a.id - b.id;
  const plain = hand.filter((c) => domainOf(c, t) !== 'trump').sort(cheap);
  return [(plain.length > 0 ? plain : [...hand].sort(cheap))[0]];
}
