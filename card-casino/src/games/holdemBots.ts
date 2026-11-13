import type { Card } from '../cards';
import { bestHand } from './pokerHands';
import { legalActions, type Action, type HoldemState } from './holdemRules';

/*
 * How the bots play. Each one scores its hand from 0 (hopeless) to 1 (unbeatable), adds a little randomness
 * so it isn't predictable, and then folds, calls or raises by simple thresholds. Bots never bluff: a raise
 * always means a good hand.
 */

/** Raise when nobody has bet yet (or it's the big blind's option) with at least this strength. */
export const RAISE_WHEN_FREE = 0.55;
/** Raise when facing a bet with at least this strength. */
export const RAISE_WHEN_FACING = 0.65;
/** How far a bot's judgement can wobble either way, as a share of the 0 to 1 scale. */
export const JITTER = 0.1;
/** To call a bet that puts all of its remaining chips at risk, a bot needs at least this strength. */
export const CALL_ALL_IN = 0.6;

const value = (card: Card) => (card.rank === 1 ? 14 : card.rank);
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/**
 * Scores two hole cards with the Chen formula, a well-known shortcut for starting-hand strength:
 * big cards, pairs and suited cards score well, and gaps between the cards cost points.
 * The result is scaled so a pair of aces is 1 and the worst hands are 0.
 */
export function preflopStrength(hole: readonly Card[]): number {
  const [high, low] = hole.map(value).sort((a, b) => b - a);
  const points = (v: number) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2);

  let chen = points(high);
  if (high === low) {
    chen = Math.max(5, chen * 2);
  } else {
    const gap = high - low - 1;
    chen -= [0, 1, 2, 4][gap] ?? 5;
    // Close cards below a queen can still make straights.
    if (gap <= 1 && high < 12) chen += 1;
  }
  if (hole[0].suit === hole[1].suit) chen += 2;

  return clamp((Math.ceil(chen) + 1) / 21);
}

/** The strongest kind of hand the board makes on its own, using the same numbering as `scoreFive`. */
function boardCategory(board: readonly Card[]): number {
  const counts = new Map<number, number>();
  for (const card of board) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  const [first = 0, second = 0] = [...counts.values()].sort((a, b) => b - a);
  if (first === 4) return 7;
  if (first === 3) return second === 2 ? 6 : 3;
  if (first === 2) return second === 2 ? 2 : 1;
  return 0;
}

/** Extra strength for a hand that is one card from a flush or a straight, with a hole card helping. */
function drawBonus(hole: readonly Card[], board: readonly Card[]): number {
  const all = [...hole, ...board];
  let bonus = 0;

  const suits = new Map<string, number>();
  for (const card of all) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
  if (hole.some((card) => suits.get(card.suit) === 4)) bonus += 0.2;

  // An ace counts low as well as high for straights.
  const present = new Set(all.flatMap((card) => (card.rank === 1 ? [1, 14] : [card.rank])));
  const holeValues = new Set(hole.flatMap((card) => (card.rank === 1 ? [1, 14] : [card.rank])));
  for (let start = 1; start <= 10; start++) {
    const window = [0, 1, 2, 3, 4].map((n) => start + n);
    if (window.filter((v) => present.has(v)).length >= 4 && window.some((v) => holeValues.has(v))) {
      bonus += 0.12;
      break;
    }
  }
  return bonus;
}

/**
 * Scores a hand once the board is out. Made hands count for the most, a hand that is only what the board
 * already shows counts for little (the other players have it too), and draws add a little on the flop and turn.
 */
export function postflopStrength(hole: readonly Card[], board: readonly Card[]): number {
  const best = bestHand([...hole, ...board]);
  const category = best.score[0];
  const made = [0.12, 0.35 + (best.score[1] / 14) * 0.15, 0.65, 0.75, 0.85, 0.9, 0.95, 1, 1];

  let strength = made[category];
  // If the board alone makes this hand, the hole cards add nothing.
  if (category <= 3 && category <= boardCategory(board)) strength = Math.min(strength, 0.15 + category * 0.05);
  if (board.length < 5 && category < 4) strength += drawBonus(hole, board);
  return clamp(strength);
}

/** How strong the seat to act believes its hand is, before any randomness. */
export function handStrength(s: HoldemState): number {
  const { hole } = s.seats[s.toAct!];
  return s.board.length === 0 ? preflopStrength(hole) : postflopStrength(hole, s.board);
}

/**
 * What the bot to act does. `random` returns a number from 0 to 1 and is only a parameter so tests can fix it.
 */
export function botAction(s: HoldemState, random: () => number = Math.random): Action {
  if (s.toAct === null) return 'check';
  const legal = legalActions(s);
  const strength = handStrength(s) + (random() - 0.5) * JITTER;

  // Nothing to pay: check, or bet a strong hand. A bot never folds when it can check.
  if (legal.check) return legal.raise && strength >= RAISE_WHEN_FREE ? 'raise' : 'check';

  if (legal.raise && strength >= RAISE_WHEN_FACING) return 'raise';

  // Otherwise call if the hand is worth the price. A bigger bet into a smaller pot needs a better hand,
  // and risking every remaining chip (calling an all-in) needs a strong one.
  const potOdds = legal.callAmount / (s.pot + legal.callAmount);
  const riskingEverything = legal.callAmount >= s.seats[s.toAct].stack;
  const needed = Math.max(0.2 + potOdds * 0.5, riskingEverything ? CALL_ALL_IN : 0);
  return strength >= needed ? 'call' : 'fold';
}
