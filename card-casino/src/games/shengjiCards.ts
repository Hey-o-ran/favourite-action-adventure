import type { Suit } from '../cards';

/*
 * Shengji (80 Points), the standard four player game with two decks. This file is the rules for cards and tricks:
 * which cards are trump, how strong each card is, what a pair, tractor and throw are, which cards you may play when
 * following, and who wins a trick. Scoring, levels and the opening live in shengjiScoring.ts.
 *
 * Ranks run 2 to 14 (the ace is 14), with the small joker 15 and the big joker 16.
 */

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const ACE = 14;
export const SMALL_JOKER = 15;
export const BIG_JOKER = 16;

/** One card. The two decks mean there are two of every card, told apart by `id`. */
export interface SCard {
  id: number;
  rank: number;
  suit: Suit | 'joker';
}

/** The level is the rank that is trump this hand. A null suit means no trump suit (only jokers and level cards). */
export interface Trump {
  level: number;
  suit: Suit | null;
}

/** The group of cards that follow each other: one of the four suits, or all the trumps together. */
export type Domain = Suit | 'trump';

export function makeDeck(): SCard[] {
  const cards: SCard[] = [];
  let id = 0;
  for (let copy = 0; copy < 2; copy++) {
    for (const suit of SUITS) for (let rank = 2; rank <= ACE; rank++) cards.push({ id: id++, rank, suit });
    cards.push({ id: id++, rank: SMALL_JOKER, suit: 'joker' });
    cards.push({ id: id++, rank: BIG_JOKER, suit: 'joker' });
  }
  return cards;
}

const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A', [SMALL_JOKER]: 'SJ', [BIG_JOKER]: 'BJ' };
const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;
export const cardName = (c: SCard) => (c.suit === 'joker' ? RANK_LABEL[c.rank] : `${RANK_LABEL[c.rank] ?? c.rank}${SUIT_SYMBOL[c.suit]}`);

/** The 5s are worth 5, and the 10s and kings 10. Two decks make 200 in all. */
export const pointsOf = (c: SCard): number => (c.suit === 'joker' ? 0 : c.rank === 5 ? 5 : c.rank === 10 || c.rank === 13 ? 10 : 0);
export const totalPoints = (cards: readonly SCard[]) => cards.reduce((sum, c) => sum + pointsOf(c), 0);

// ---------------------------------------------------------------- trump and strength

export const isJoker = (c: SCard) => c.suit === 'joker';
/** Jokers, cards of the level rank, and cards of the trump suit are all trump. */
export const isTrump = (c: SCard, t: Trump) => isJoker(c) || c.rank === t.level || c.suit === t.suit;
export const domainOf = (c: SCard, t: Trump): Domain => (isTrump(c, t) ? 'trump' : (c.suit as Suit));

/** The place of a rank among the 12 ranks of a suit once the level rank is taken out: 1 is the lowest. */
const slotOf = (rank: number, level: number) => (rank < level ? rank - 1 : rank - 2);

/**
 * How strong a card is inside its group. A higher number is stronger, and numbers that follow each other are neighbours,
 * which is what a tractor needs. The level rank is not part of its suit, so 4 and 6 are neighbours when 5 is the level.
 * In the trump group, from the top: big joker, small joker, the level card of the trump suit, the level cards of the
 * other suits (all equal), then the trump suit from ace down.
 */
export function positionOf(c: SCard, t: Trump): number {
  if (isJoker(c)) return c.rank === BIG_JOKER ? 16 : 15;
  if (c.rank === t.level) return t.suit === null ? 14 : c.suit === t.suit ? 14 : 13;
  return slotOf(c.rank, t.level);
}

// ---------------------------------------------------------------- pairs, tractors and throws

export type ComboKind = 'single' | 'pair' | 'tractor';
export interface Combo {
  kind: ComboKind;
  cards: SCard[];
  /** How many pairs: 1 for a pair, 2 or more for a tractor. */
  length: number;
  /** The strength of the highest card. */
  key: number;
  domain: Domain;
}

const sameCard = (a: SCard, b: SCard) => a.rank === b.rank && a.suit === b.suit;
const byPositionDesc = (t: Trump) => (a: SCard, b: SCard) => positionOf(b, t) - positionOf(a, t) || a.id - b.id;

interface Pair {
  cards: [SCard, SCard];
  position: number;
}

/** Every pair among the cards: two cards of the same rank and suit. (The same number in two suits is not a pair.) */
export function pairsIn(cards: readonly SCard[], t: Trump): Pair[] {
  const pairs: Pair[] = [];
  const used = new Set<number>();
  for (const a of cards) {
    if (used.has(a.id)) continue;
    const b = cards.find((x) => x.id !== a.id && !used.has(x.id) && sameCard(a, x));
    if (!b) continue;
    used.add(a.id);
    used.add(b.id);
    pairs.push({ cards: [a, b], position: positionOf(a, t) });
  }
  return pairs.sort((x, y) => y.position - x.position);
}

/** A run of `length` pairs whose strengths follow each other. Returns the pairs, highest first, or null. */
export function findChain(pairs: readonly Pair[], length: number, aboveKey = -1): Pair[] | null {
  for (const start of pairs) {
    if (start.position <= aboveKey) continue;
    const chain = [start];
    while (chain.length < length) {
      const next = pairs.find((p) => p.position === chain[chain.length - 1].position - 1 && !chain.includes(p));
      if (!next) break;
      chain.push(next);
    }
    if (chain.length === length) return chain;
  }
  return null;
}

const comboOf = (cards: SCard[], length: number, key: number, domain: Domain): Combo => ({
  kind: length === 0 ? 'single' : length === 1 ? 'pair' : 'tractor',
  cards,
  length: Math.max(length, 1),
  key,
  domain,
});

/**
 * Splits cards of one group into the biggest pieces: the longest tractors first, then pairs, then single cards.
 * Biggest piece first, and the stronger first among equals.
 */
export function decompose(cards: readonly SCard[], t: Trump): Combo[] {
  if (cards.length === 0) return [];
  const domain = domainOf(cards[0], t);
  let pairs = pairsIn(cards, t);
  const inPair = new Set(pairs.flatMap((p) => p.cards.map((c) => c.id)));
  const singles = cards.filter((c) => !inPair.has(c.id));
  const combos: Combo[] = [];

  for (let length = Math.floor(cards.length / 2); length >= 2; length--) {
    for (let chain = findChain(pairs, length); chain; chain = findChain(pairs, length)) {
      combos.push(comboOf(chain.flatMap((p) => p.cards), length, chain[0].position, domain));
      pairs = pairs.filter((p) => !chain.includes(p));
    }
  }
  for (const p of pairs) combos.push(comboOf([...p.cards], 1, p.position, domain));
  for (const c of [...singles].sort(byPositionDesc(t))) combos.push(comboOf([c], 0, positionOf(c, t), domain));

  return combos.sort((a, b) => b.cards.length - a.cards.length || b.key - a.key);
}

/** What a play is made of, such as "T2,P,S" for a tractor of two pairs, a pair and a single. Plays match if this matches. */
export const structureOf = (combos: readonly Combo[]) =>
  combos
    .map((c) => (c.kind === 'tractor' ? `T${c.length}` : c.kind === 'pair' ? 'P' : 'S'))
    .sort()
    .join(',');

/** The strength that decides who wins when two plays of the same shape meet: the highest card of the biggest piece. */
export const mainKey = (combos: readonly Combo[]) => [...combos].sort((a, b) => b.cards.length - a.cards.length || b.key - a.key)[0].key;

export interface Analysis {
  /** Null when the cards come from more than one group, which is not a legal lead. */
  domain: Domain | null;
  combos: Combo[];
}

export function analyze(cards: readonly SCard[], t: Trump): Analysis {
  if (cards.length === 0) return { domain: null, combos: [] };
  const domains = new Set(cards.map((c) => domainOf(c, t)));
  if (domains.size > 1) return { domain: null, combos: [] };
  return { domain: domainOf(cards[0], t), combos: decompose(cards, t) };
}

/** A lead of several pieces at once (like a king and a pair of queens) is a throw. */
export const isThrow = (a: Analysis) => a.combos.length > 1;

/** Could this player beat this piece, using only cards of its own group? */
function canBeatPiece(piece: Combo, hand: readonly SCard[], t: Trump): boolean {
  const same = hand.filter((c) => domainOf(c, t) === piece.domain);
  if (piece.kind === 'single') return same.some((c) => positionOf(c, t) > piece.key);
  return findChain(pairsIn(same, t), piece.length, piece.key) !== null;
}

export type ThrowCheck = { ok: true } | { ok: false; forced: Combo };

/**
 * A throw only stands if none of the other players could beat any piece of it. If one could, the leader has to play
 * just the weakest piece instead.
 */
export function checkThrow(combos: readonly Combo[], opponentHands: readonly (readonly SCard[])[], t: Trump): ThrowCheck {
  if (combos.length < 2) return { ok: true };
  for (const piece of combos) {
    if (opponentHands.some((hand) => canBeatPiece(piece, hand, t))) {
      const weakest = [...combos].sort((a, b) => a.key - b.key || a.cards.length - b.cards.length)[0];
      return { ok: false, forced: weakest };
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------- following a lead

/**
 * Checks a play against the lead. Returns null if it is legal, or a short reason why not.
 * The rules: play the same number of cards. If you have enough cards of the led group, they must all come from it,
 * matching the shape of the lead as far as your hand allows: a tractor if you have one, else as many pairs as you can,
 * then singles. If you have fewer, you must play all of them, and anything else makes up the number.
 */
export function checkFollow(hand: readonly SCard[], play: readonly SCard[], lead: Analysis, t: Trump): string | null {
  if (lead.domain === null) return 'There is no lead to follow';
  if (new Set(play.map((c) => c.id)).size !== play.length) return 'A card is played twice';
  if (!play.every((c) => hand.some((h) => h.id === c.id))) return 'You do not hold those cards';
  const count = lead.combos.reduce((n, c) => n + c.cards.length, 0);
  if (play.length !== count) return `Play exactly ${count} card${count === 1 ? '' : 's'}`;

  const inGroup = (c: SCard) => domainOf(c, t) === lead.domain;
  const held = hand.filter(inGroup);
  const played = play.filter(inGroup);

  if (held.length <= count) return played.length === held.length ? null : 'You must play all your cards of the led suit';
  if (played.length !== count) return 'You must follow the led suit';

  // Enough cards of the group: the shape of the lead decides what must be played.
  const need = followRequirement(held, lead.combos, t);
  let playedPairs = pairsIn(played, t);
  for (const length of need.tractors) {
    const chain = findChain(playedPairs, length);
    if (!chain) return `You must play a tractor of ${length} pairs`;
    playedPairs = playedPairs.filter((p) => !chain.includes(p));
  }
  return playedPairs.length >= need.pairs ? null : 'You must play your pairs';
}

interface Requirement {
  /** The lengths (in pairs) of the tractors that must be played. */
  tractors: number[];
  /** How many more pairs must be played besides those. */
  pairs: number;
}

/** What a player who holds `held` (more cards of the led group than the lead has) has to match from the lead's pieces. */
function followRequirement(held: readonly SCard[], pieces: readonly Combo[], t: Trump): Requirement {
  let spare = pairsIn(held, t);
  const tractors: number[] = [];
  let pairs = 0;
  for (const piece of [...pieces].sort((a, b) => b.cards.length - a.cards.length)) {
    if (piece.kind === 'tractor') {
      const chain = findChain(spare, piece.length);
      if (chain) {
        tractors.push(piece.length);
        spare = spare.filter((p) => !chain.includes(p));
      } else {
        const take = Math.min(piece.length, spare.length);
        pairs += take;
        spare = spare.slice(take);
      }
    } else if (piece.kind === 'pair' && spare.length > 0) {
      pairs += 1;
      spare = spare.slice(1);
    }
  }
  return { tractors, pairs };
}

/** Cheapest first: cards worth no points, then the lowest. Used to pick what to give away when there is a choice. */
const cheapestFirst = (t: Trump) => (a: SCard, b: SCard) => pointsOf(a) - pointsOf(b) || positionOf(a, t) - positionOf(b, t) || a.id - b.id;

/** The lowest tractor of `length` pairs among these pairs, if there is one. */
function lowestChain(pairs: readonly Pair[], length: number): Pair[] | null {
  for (const start of [...pairs].sort((a, b) => a.position - b.position)) {
    const chain = findChain(pairs.filter((p) => p.position <= start.position), length);
    if (chain && chain[0] === start) return chain;
  }
  return null;
}

/**
 * Some legal way to follow a lead, giving away the cheapest cards the rules allow. Always passes `checkFollow`.
 * Used for bots, and to show a player the cards they are forced to play.
 */
export function legalFollow(hand: readonly SCard[], lead: Analysis, t: Trump): SCard[] {
  const count = lead.combos.reduce((n, c) => n + c.cards.length, 0);
  const cheap = cheapestFirst(t);
  const inGroup = (c: SCard) => domainOf(c, t) === lead.domain;
  const held = hand.filter(inGroup).sort(cheap);

  if (held.length <= count) {
    const others = hand.filter((c) => !inGroup(c)).sort(cheap);
    return [...held, ...others.slice(0, count - held.length)];
  }

  const need = followRequirement(held, lead.combos, t);
  const chosen: SCard[] = [];
  let pairs = pairsIn(held, t);
  for (const length of need.tractors) {
    const chain = lowestChain(pairs, length);
    if (!chain) continue;
    chosen.push(...chain.flatMap((p) => p.cards));
    pairs = pairs.filter((p) => !chain.includes(p));
  }
  for (const pair of [...pairs].sort((a, b) => a.position - b.position).slice(0, need.pairs)) chosen.push(...pair.cards);
  const taken = new Set(chosen.map((c) => c.id));
  for (const card of held) {
    if (chosen.length >= count) break;
    if (!taken.has(card.id)) chosen.push(card);
  }
  return chosen.slice(0, count);
}

// ---------------------------------------------------------------- winning a trick

export interface Play {
  seat: number;
  cards: SCard[];
}

/**
 * Who wins the trick. Plays are in the order they were made, the lead first.
 * A play can only win if it is the same shape as the lead (a pair for a pair, and so on). Playing every card from the led
 * group wins by strength. If the lead was not trump, a player who has none of that suit can instead play all trump in the
 * same shape, which beats any play from the led group, and the strongest trump play wins.
 */
export function trickWinner(plays: readonly Play[], t: Trump): number {
  const lead = analyze(plays[0].cards, t);
  const shape = structureOf(lead.combos);
  let best = { seat: plays[0].seat, ruff: false, key: mainKey(lead.combos) };

  for (const play of plays.slice(1)) {
    const a = analyze(play.cards, t);
    if (a.domain === null || structureOf(a.combos) !== shape) continue;
    const ruff = a.domain === 'trump' && lead.domain !== 'trump';
    if (a.domain !== lead.domain && !ruff) continue;
    const key = mainKey(a.combos);
    if (Number(ruff) > Number(best.ruff) || (ruff === best.ruff && key > best.key)) best = { seat: play.seat, ruff, key };
  }
  return best.seat;
}

/** A hand sorted for the player: trumps first, then each suit, strongest to weakest. */
export function sortHand(cards: readonly SCard[], t: Trump): SCard[] {
  const order: Domain[] = ['trump', 'spades', 'hearts', 'clubs', 'diamonds'];
  return [...cards].sort(
    (a, b) => order.indexOf(domainOf(a, t)) - order.indexOf(domainOf(b, t)) || positionOf(b, t) - positionOf(a, t) || a.suit.localeCompare(b.suit) || a.id - b.id,
  );
}
