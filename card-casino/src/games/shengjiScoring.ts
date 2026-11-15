import type { Suit } from '../cards';
import { ACE, BIG_JOKER, SMALL_JOKER, analyze, cardName, pointsOf, type SCard, type Trump } from './shengjiCards';

/*
 * The rest of Shengji's rules: dealing, declaring trump, the kitty, counting points, and how levels move.
 * Seats go clockwise from 0. Seats 0 and 2 are one side and seats 1 and 3 the other.
 */

export const PLAYERS = 4;
export const HAND_SIZE = 25;
export const KITTY_SIZE = 8;
/** The attacking side needs this many of the 200 points to win. */
export const ATTACK_TARGET = 80;
export const FIRST_LEVEL = 2;

export const teamOf = (seat: number) => seat % 2;
export const partnerOf = (seat: number) => (seat + 2) % PLAYERS;

// ---------------------------------------------------------------- dealing

/**
 * Deals one card at a time round the table, starting with `firstSeat`, until each player has 25. The last 8 are the kitty.
 * `dealOrder` is each card in the order it is dealt, so a screen can show the deal and let players declare as it goes.
 */
export function deal(deck: readonly SCard[], firstSeat: number): { hands: SCard[][]; kitty: SCard[]; dealOrder: { seat: number; card: SCard }[] } {
  if (deck.length !== PLAYERS * HAND_SIZE + KITTY_SIZE) throw new Error('A Shengji deck has 108 cards');
  const hands: SCard[][] = Array.from({ length: PLAYERS }, () => []);
  const dealOrder: { seat: number; card: SCard }[] = [];
  for (let i = 0; i < PLAYERS * HAND_SIZE; i++) {
    const seat = (firstSeat + i) % PLAYERS;
    hands[seat].push(deck[i]);
    dealOrder.push({ seat, card: deck[i] });
  }
  return { hands, kitty: deck.slice(PLAYERS * HAND_SIZE), dealOrder };
}

// ---------------------------------------------------------------- declaring trump

/**
 * A declaration: showing level cards (or jokers) during the deal to name the trump suit.
 * From weakest to strongest: one level card (1), a pair of the same level card (2), a pair of small jokers (3), a pair
 * of big jokers (4). The last two have no trump suit. A stronger declaration overrules a weaker one.
 */
export interface Declaration {
  strength: 1 | 2 | 3 | 4;
  /** The trump suit, or null for no trump. */
  suit: Suit | null;
}

/** What showing these cards declares at this level, or null if they do not make a declaration. */
export function readDeclaration(cards: readonly SCard[], level: number): Declaration | null {
  if (cards.length === 1) {
    const [c] = cards;
    return c.suit !== 'joker' && c.rank === level ? { strength: 1, suit: c.suit } : null;
  }
  if (cards.length === 2) {
    const [a, b] = cards;
    if (a.rank !== b.rank || a.suit !== b.suit) return null;
    if (a.suit === 'joker') return a.rank === BIG_JOKER ? { strength: 4, suit: null } : a.rank === SMALL_JOKER ? { strength: 3, suit: null } : null;
    return a.rank === level ? { strength: 2, suit: a.suit } : null;
  }
  return null;
}

/** Can this declaration be made now? It must be stronger than the one already standing, if any. */
export const canDeclare = (next: Declaration, standing: Declaration | null) => next.strength > (standing?.strength ?? 0);

/**
 * If nobody declared during the deal, the kitty decides: its cards are turned over one at a time and the first level
 * card sets the trump suit. With none, the suit of the highest card sets it, and if that is a joker there is no trump suit.
 */
export function trumpFromKitty(kitty: readonly SCard[], level: number): Suit | null {
  const levelCard = kitty.find((c) => c.suit !== 'joker' && c.rank === level);
  if (levelCard) return levelCard.suit as Suit;
  const highest = kitty.reduce((best, c) => (c.rank > best.rank ? c : best), kitty[0]);
  return highest.suit === 'joker' ? null : highest.suit;
}

// ---------------------------------------------------------------- the kitty

/** The declarer picks up the kitty, 33 cards in all, and puts 8 back face down. Returns a reason if the choice is not allowed. */
export function checkBury(hand: readonly SCard[], kitty: readonly SCard[], bury: readonly SCard[]): string | null {
  if (bury.length !== KITTY_SIZE) return `Put exactly ${KITTY_SIZE} cards back`;
  if (new Set(bury.map((c) => c.id)).size !== bury.length) return 'A card is chosen twice';
  const all = [...hand, ...kitty];
  return bury.every((b) => all.some((c) => c.id === b.id)) ? null : 'Those cards are not yours';
}

// ---------------------------------------------------------------- points

/**
 * The kitty points are doubled for the shape of the last trick's winning play, if the attackers win that last trick:
 * 2 for a single card, 4 for a pair, and 4 for each pair in a tractor. A throw counts by its biggest piece.
 */
export function kittyMultiplier(lastWinningPlay: readonly SCard[], t: Trump): number {
  const { combos } = analyze(lastWinningPlay, t);
  const biggest = Math.max(...combos.map((c) => c.cards.length));
  return 2 * biggest;
}

export interface HandPoints {
  /** Points in the tricks the attackers won. */
  trickPoints: number;
  /** Points in the buried kitty. */
  kittyPoints: number;
  /** Whether the attackers won the last trick, which gives them the kitty points. */
  attackersWonLast: boolean;
  /** The multiplier from `kittyMultiplier` for that last trick. */
  multiplier: number;
}

/** The attackers' score: the points they won, plus the kitty (multiplied) if they took the last trick. */
export const attackerScore = (p: HandPoints) => p.trickPoints + (p.attackersWonLast ? p.kittyPoints * p.multiplier : 0);

export const kittyPointsOf = (kitty: readonly SCard[]) => kitty.reduce((n, c) => n + pointsOf(c), 0);

// ---------------------------------------------------------------- levels

export interface HandOutcome {
  winner: 'attackers' | 'defenders';
  /** How many levels the winning side moves up. */
  levels: number;
}

/**
 * Who wins and how many levels they gain, from the attackers' score.
 * Defenders hold them: under 40 points is 2 levels, none at all is 3, otherwise 1.
 * Attackers get 80 to 119: they take over as declarers without a level; 120 to 159: 1; 160 to 199: 2; 200 and up: 3.
 */
export function outcomeFor(score: number): HandOutcome {
  if (score < ATTACK_TARGET) return { winner: 'defenders', levels: score === 0 ? 3 : score < 40 ? 2 : 1 };
  return { winner: 'attackers', levels: score < 120 ? 0 : score < 160 ? 1 : score < 200 ? 2 : 3 };
}

/** What a won hand pays per coin bet, stake included: 2x for 0 or 1 level, 3x for 2 levels, 4x for 3. A loss pays nothing. */
export const payoutMultiple = (levels: number) => (levels >= 3 ? 4 : levels === 2 ? 3 : 2);

export interface Standing {
  /** The level each side is on: index 0 is seats 0 and 2, index 1 is seats 1 and 3. */
  levels: [number, number];
  /** Who declares the next hand. */
  declarer: number;
}

export interface NextHand extends Standing {
  /** Set when a side has won the whole game by winning a hand as declarers at ace. */
  gameWonBy: 0 | 1 | null;
}

/**
 * What happens after a hand. The winning side gains its levels (stopping at ace). If the defenders held, the declarer's partner
 * declares next. If the attackers won, they declare next, starting with the player after the old declarer.
 * A side wins the whole game by winning a hand as declarers while already at ace.
 */
export function nextHand(standing: Standing, outcome: HandOutcome): NextHand {
  const declaringTeam = teamOf(standing.declarer);
  const winningTeam = outcome.winner === 'defenders' ? declaringTeam : 1 - declaringTeam;
  const levels: [number, number] = [...standing.levels];
  const gameWonBy = outcome.winner === 'defenders' && levels[declaringTeam] === ACE ? (declaringTeam as 0 | 1) : null;
  levels[winningTeam] = Math.min(ACE, levels[winningTeam] + outcome.levels);
  return {
    levels,
    declarer: outcome.winner === 'defenders' ? partnerOf(standing.declarer) : (standing.declarer + 1) % PLAYERS,
    gameWonBy,
  };
}

/** The trump level of a hand is the level of the side that is declaring. */
export const handLevel = (standing: Standing) => standing.levels[teamOf(standing.declarer)];

export const levelLabel = (level: number) => cardName({ id: 0, rank: level, suit: 'spades' }).replace('♠', '');
