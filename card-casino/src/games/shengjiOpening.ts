import { pairsIn, type SCard, type Trump } from './shengjiCards';
import {
  PLAYERS,
  canDeclare,
  checkBury,
  deal,
  handLevel,
  partnerOf,
  readDeclaration,
  trumpFromKitty,
  type Declaration,
  type Standing,
} from './shengjiScoring';
import { cheapestEight, playFrom, type HandState } from './shengjiTable';

/*
 * The opening of a hand: the deal, during which players may declare trump by showing level cards or jokers, and then the
 * declarer picking up the kitty and burying 8 cards. Cards are dealt one at a time so a screen can show it. The bots
 * declare from the cards they hold so far, and look at nothing else.
 * Who declares the hand is already set by the standing; a declaration here names the trump suit.
 */

export interface Declared {
  seat: number;
  declaration: Declaration;
  cards: SCard[];
}

export interface Opening {
  standing: Standing;
  level: number;
  /** The cards each player has been dealt so far. */
  hands: SCard[][];
  kitty: SCard[];
  dealOrder: { seat: number; card: SCard }[];
  dealt: number;
  /** The declaration standing now, if anyone has made one. */
  declared: Declared | null;
  phase: 'dealing' | 'kitty';
  /** Known once the deal has finished. */
  trump: Trump | null;
  log: string;
}

export const TOTAL_DEALT = 100;

export function startOpening(deck: readonly SCard[], standing: Standing): Opening {
  const { kitty, dealOrder } = deal(deck, standing.declarer);
  return {
    standing,
    level: handLevel(standing),
    hands: Array.from({ length: PLAYERS }, () => []),
    kitty,
    dealOrder,
    dealt: 0,
    declared: null,
    phase: 'dealing',
    trump: null,
    log: '',
  };
}

const SEAT = ['You', 'The left opponent', 'Your partner', 'The right opponent'] as const;

function describeDeclaration(seat: number, d: Declaration): string {
  const what = d.suit === null ? 'no trump' : d.suit;
  return `${SEAT[seat]} ${seat === 0 ? 'declare' : 'declares'} ${what}${d.strength === 2 ? ' with a pair' : ''}.`;
}

export type OpeningOutcome = { ok: true; opening: Opening } | { ok: false; error: string };

/** A player shows cards to declare trump. Allowed during the deal, if the cards are held and stronger than the standing declaration. */
export function declare(o: Opening, seat: number, cards: readonly SCard[]): OpeningOutcome {
  if (o.phase !== 'dealing') return { ok: false, error: 'The deal is over' };
  if (!cards.every((c) => o.hands[seat].some((h) => h.id === c.id))) return { ok: false, error: 'Those cards are not in the hand' };
  const declaration = readDeclaration(cards, o.level);
  if (!declaration) return { ok: false, error: 'Show a level card, a pair of level cards or a pair of jokers' };
  if (!canDeclare(declaration, o.declared?.declaration ?? null)) return { ok: false, error: 'That does not beat the declaration already made' };
  return { ok: true, opening: { ...o, declared: { seat, declaration, cards: [...cards] }, log: describeDeclaration(seat, declaration) } };
}

/** What a bot would declare with the cards it holds now, or null. It never overrules its partner, and only declares with level cards. */
export function botDeclaration(o: Opening, seat: number): SCard[] | null {
  if (o.declared?.seat === partnerOf(seat) || o.declared?.seat === seat) return null;
  const levelCards = o.hands[seat].filter((c) => c.suit !== 'joker' && c.rank === o.level);
  const pair = pairsIn(levelCards, { level: o.level, suit: null })[0];
  if (pair && declare(o, seat, pair.cards).ok) return [...pair.cards];
  if (o.declared || levelCards.length === 0) return null;
  const count = (suit: string) => o.hands[seat].filter((c) => c.suit === suit).length;
  return [[...levelCards].sort((a, b) => count(b.suit) - count(a.suit) || a.id - b.id)[0]];
}

/** Deals the next card, lets the bots declare, and at the end of the deal sets the trump. */
export function dealOne(o: Opening): Opening {
  if (o.phase !== 'dealing') return o;
  const { seat, card } = o.dealOrder[o.dealt];
  let next: Opening = { ...o, hands: o.hands.map((h, s) => (s === seat ? [...h, card] : h)), dealt: o.dealt + 1, log: '' };
  for (let bot = 1; bot < PLAYERS; bot++) {
    const cards = botDeclaration(next, bot);
    if (!cards) continue;
    const out = declare(next, bot, cards);
    if (out.ok) next = out.opening;
  }
  if (next.dealt < TOTAL_DEALT) return next;
  const suit = next.declared ? next.declared.declaration.suit : trumpFromKitty(next.kitty, next.level);
  const log = next.declared ? next.log : `Nobody declared, so the kitty names the trump${suit === null ? ': no trump suit.' : `: ${suit}.`}`;
  return { ...next, phase: 'kitty', trump: { level: next.level, suit }, log };
}

/** The 33 cards the declarer holds once they pick up the kitty. */
export const declarerCards = (o: Opening): SCard[] => [...o.hands[o.standing.declarer], ...o.kitty];

/** The declarer puts back 8 cards. Returns the table, ready to play. */
export function buryKitty(o: Opening, bury: readonly SCard[]): { ok: true; state: HandState } | { ok: false; error: string } {
  if (o.phase !== 'kitty' || !o.trump) return { ok: false, error: 'The deal is not over' };
  const error = checkBury(o.hands[o.standing.declarer], o.kitty, bury);
  if (error) return { ok: false, error };
  const hands = o.hands.map((h) => [...h]);
  hands[o.standing.declarer] = declarerCards(o).filter((c) => !bury.some((b) => b.id === c.id));
  return { ok: true, state: playFrom(o.standing, o.trump, hands, [...bury]) };
}

/** A bot declarer buries its cheapest 8 cards. */
export function botBury(o: Opening): HandState {
  const out = buryKitty(o, cheapestEight(declarerCards(o), o.trump!));
  if (!out.ok) throw new Error(out.error);
  return out.state;
}

/** The whole opening with the human never declaring and the declarer burying their cheapest 8 cards, as a bot would. */
export function autoOpening(deck: readonly SCard[], standing: Standing): HandState {
  let o = startOpening(deck, standing);
  while (o.phase === 'dealing') o = dealOne(o);
  return botBury(o);
}
