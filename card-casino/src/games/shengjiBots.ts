import {
  analyze,
  checkFollow,
  decompose,
  domainOf,
  isTrump,
  legalFollow,
  pairsIn,
  pointsOf,
  positionOf,
  trickWinner,
  SUITS,
  type Analysis,
  type Combo,
  type SCard,
  type Trump,
} from './shengjiCards';
import { teamOf } from './shengjiScoring';
import type { HandState } from './shengjiTable';

/*
 * The bots in Shengji. They play fair: a bot looks only at its own hand, the cards already played (and the kitty, if it
 * buried it), the trick on the table and the rules. It never looks at another hand. The two bots on a side work as a team.
 *
 * Leading: play a card nobody can beat (a "master"), else give up the cheapest plain card.
 * Following: if a partner is winning and this is the last play, feed points to them. If an opponent is winning, take the
 * trick with the cheapest play that wins when there are points to gain. Otherwise give away the cheapest legal cards.
 */

/** What it costs to give a card away: points first, then trumps, then strength. */
const cost = (c: SCard, t: Trump) => pointsOf(c) * 100 + (isTrump(c, t) ? 50 : 0) + positionOf(c, t);
const playCost = (cards: readonly SCard[], t: Trump) => cards.reduce((n, c) => n + cost(c, t), 0);

/** The cards this bot cannot see: both decks, less its own hand, the played cards, the trick, and its own buried kitty. */
function unseenCards(state: HandState, seat: number): SCard[] {
  const seen: SCard[] = [...state.hands[seat], ...state.played, ...state.trick.flatMap((p) => p.cards)];
  if (seat === state.declarer) seen.push(...state.kitty);
  const left: SCard[] = [];
  const suits = [...SUITS, 'joker'] as const;
  for (const suit of suits) {
    const ranks = suit === 'joker' ? [15, 16] : Array.from({ length: 13 }, (_, i) => i + 2);
    for (const rank of ranks) {
      const unseen = 2 - seen.filter((c) => c.rank === rank && c.suit === suit).length;
      for (let i = 0; i < unseen; i++) left.push({ id: -1 - left.length, rank, suit });
    }
  }
  return left;
}

/** Could somebody still beat this piece with cards from its own group? (Ruffing a plain suit is not counted.) */
function canBeBeaten(piece: Combo, unseen: readonly SCard[], t: Trump): boolean {
  const same = unseen.filter((c) => domainOf(c, t) === piece.domain);
  if (piece.kind === 'single') return same.some((c) => positionOf(c, t) > piece.key);
  return pairsIn(same, t).some((p) => p.position > piece.key);
}

function leadCards(state: HandState): SCard[] {
  const seat = state.turn;
  const hand = state.hands[seat];
  const t = state.trump;
  const unseen = unseenCards(state, seat);
  const plain = hand.filter((c) => !isTrump(c, t));

  const pieces = SUITS.flatMap((suit) => decompose(plain.filter((c) => c.suit === suit), t));
  const masters = pieces.filter((p) => !canBeBeaten(p, unseen, t)).sort((a, b) => b.cards.length - a.cards.length || b.key - a.key);
  if (masters.length > 0) return masters[0].cards;

  const cheapestSingle = (cards: readonly SCard[]) => {
    const singles = decompose(cards, t).filter((p) => p.kind === 'single');
    const pool = singles.length > 0 ? singles.map((p) => p.cards[0]) : [...cards];
    return [pool.sort((a, b) => cost(a, t) - cost(b, t) || a.id - b.id)[0]];
  };
  if (plain.length > 0) return cheapestSingle(plain);
  return cheapestSingle(hand);
}

/** Valid ways to follow that the bot might prefer to the cheapest one: stronger cards of the led group, or ruffing. */
function followOptions(hand: readonly SCard[], lead: Analysis, t: Trump): SCard[][] {
  const options: SCard[][] = [legalFollow(hand, lead, t)];
  const inGroup = (c: SCard) => domainOf(c, t) === lead.domain;
  const void_ = !hand.some(inGroup);
  const positions = [...new Set(hand.filter((c) => isTrump(c, t) || inGroup(c)).map((c) => positionOf(c, t)))];
  for (const k of positions) {
    const strong = hand.filter((c) => !inGroup(c) || positionOf(c, t) >= k);
    options.push(legalFollow(strong, lead, t));
    if (void_) options.push(legalFollow(hand.filter((c) => isTrump(c, t) && positionOf(c, t) >= k), lead, t));
  }
  return options.filter((o) => checkFollow(hand, o, lead, t) === null);
}

/** Swaps cheap cards of a legal play for point cards, where the rules still allow it. For feeding a partner who is winning. */
function feed(hand: readonly SCard[], play: SCard[], lead: Analysis, t: Trump): SCard[] {
  const current = [...play];
  const candidates = [...hand].sort((a, b) => pointsOf(b) - pointsOf(a) || positionOf(a, t) - positionOf(b, t));
  for (let i = 0; i < current.length; i++) {
    for (const card of candidates) {
      if (pointsOf(card) <= pointsOf(current[i])) break;
      if (current.some((c) => c.id === card.id) || (isTrump(card, t) && !isTrump(current[i], t))) continue;
      const next = current.map((c, j) => (j === i ? card : c));
      if (checkFollow(hand, next, lead, t) === null) {
        current[i] = card;
        break;
      }
    }
  }
  return current;
}

function followCards(state: HandState): SCard[] {
  const seat = state.turn;
  const hand = state.hands[seat];
  const t = state.trump;
  const lead = analyze(state.trick[0].cards, t);
  const cheapest = legalFollow(hand, lead, t);
  const tablePoints = state.trick.flatMap((p) => p.cards).reduce((n, c) => n + pointsOf(c), 0);
  const winner = trickWinner(state.trick, t);

  if (teamOf(winner) === teamOf(seat)) return state.trick.length === 3 ? feed(hand, cheapest, lead, t) : cheapest;

  const winning = followOptions(hand, lead, t)
    .filter((o) => trickWinner([...state.trick, { seat, cards: o }], t) === seat)
    .sort((a, b) => playCost(a, t) - playCost(b, t));
  const best = winning[0];
  if (!best) return cheapest;
  const ruffs = lead.domain !== 'trump' && best.some((c) => isTrump(c, t));
  return tablePoints > 0 || !ruffs ? best : cheapest;
}

/** The cards this bot plays now. It always makes a legal play. */
export function botCards(state: HandState): SCard[] {
  return state.trick.length === 0 ? leadCards(state) : followCards(state);
}

