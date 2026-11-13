import { drawCard, type Card } from '../cards';
import { bestHand, compareScores } from './pokerHands';

/*
 * Texas Hold'em for three players: seat 0 is the human, seats 1 and 2 are bots.
 *
 * House rules, kept simple on purpose:
 *  - Fixed limit. Bets are 2 coins before the flop and on the flop, and 4 on the turn and river.
 *  - At most 2 raises per round (an opening bet doesn't count as a raise).
 *  - No side pots. Nobody can bet more than the shortest stack still in the hand, so every bet
 *    can always be matched in full and everyone left at showdown has put in the same amount.
 *  - All in: a seat may bet straight up to that limit instead of the usual fixed amount, even after
 *    the raises have run out. If it holds the shortest stack that really is all its chips; otherwise it
 *    is the most the table can match, and it keeps the chips it didn't need.
 */

export const SEAT_COUNT = 3;
export const BUY_IN = 100;
export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const MAX_RAISES = 2;

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type Action = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface Seat {
  /** Chips behind, not yet in the pot. */
  stack: number;
  hole: Card[];
  folded: boolean;
  /** Chips put in during the current betting round. */
  bet: number;
  /** Chips put in during the whole hand. */
  totalIn: number;
  /** Whether this seat has acted since the last raise. */
  acted: boolean;
}

export interface HoldemState {
  seats: Seat[];
  deck: Card[];
  board: Card[];
  /** The dealer button. The next seat posts the small blind and the one after that the big blind. */
  button: number;
  street: Street;
  pot: number;
  /** The highest total anyone has bet this round. */
  currentBet: number;
  raises: number;
  /** Whose turn it is, or null once the hand is over. */
  toAct: number | null;
  /** Hand over: the seats that won a share of the pot. */
  winners: number[];
  /** Chips won by each seat at the end of the hand. */
  payouts: number[];
  /** Hand names at showdown, per seat (null for folded seats, and when everyone else folded). */
  handNames: (string | null)[];
  over: boolean;
  log: string[];
}

export interface LegalActions {
  fold: boolean;
  check: boolean;
  call: boolean;
  /** Chips needed to call. */
  callAmount: number;
  raise: boolean;
  /** The total this seat's bet becomes if it raises. */
  raiseTo: number;
  /** Whether the seat can bet up to the table limit, going past the fixed bet size and the raise limit. */
  allIn: boolean;
  /** The total this seat's bet becomes if it goes all in. */
  allInTo: number;
}

export const betSize = (street: Street) => (street === 'preflop' || street === 'flop' ? 2 : 4);

const NO_ACTIONS: LegalActions = {
  fold: false,
  check: false,
  call: false,
  callAmount: 0,
  raise: false,
  raiseTo: 0,
  allIn: false,
  allInTo: 0,
};

const left = (seat: number) => (seat + 1) % SEAT_COUNT;

/** The most any seat may have bet this round: the smallest (stack + bet) among seats still in the hand. */
function betCap(s: HoldemState): number {
  return Math.min(...s.seats.filter((x) => !x.folded).map((x) => x.stack + x.bet));
}

/**
 * Deals a new hand. Every seat needs at least a big blind behind it, so blinds can always be posted in full.
 * Pass the stacks carried over from the last hand, the new button position, and a shuffled deck.
 */
export function startHand(stacks: readonly number[], button: number, deck: readonly Card[]): HoldemState {
  if (stacks.length !== SEAT_COUNT) throw new Error(`Need ${SEAT_COUNT} stacks`);
  if (stacks.some((n) => n < BIG_BLIND)) throw new Error('Every seat needs at least a big blind');

  const seats: Seat[] = stacks.map((stack) => ({ stack, hole: [], folded: false, bet: 0, totalIn: 0, acted: false }));
  let rest = [...deck];
  // Cards go around the table twice, starting with the small blind.
  const smallBlind = left(button);
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < SEAT_COUNT; i++) {
      const [card, remaining] = drawCard(rest);
      rest = remaining;
      seats[(smallBlind + i) % SEAT_COUNT].hole.push(card);
    }
  }

  const bigBlind = left(smallBlind);
  const post = (seat: number, amount: number) => {
    seats[seat].stack -= amount;
    seats[seat].bet = amount;
    seats[seat].totalIn = amount;
  };
  post(smallBlind, SMALL_BLIND);
  post(bigBlind, BIG_BLIND);

  return {
    seats,
    deck: rest,
    board: [],
    button,
    street: 'preflop',
    pot: SMALL_BLIND + BIG_BLIND,
    currentBet: BIG_BLIND,
    raises: 0,
    toAct: left(bigBlind), // with three players, that's the button
    winners: [],
    payouts: [0, 0, 0],
    handNames: [null, null, null],
    over: false,
    log: [`Seat ${smallBlind} posts the small blind, seat ${bigBlind} the big blind.`],
  };
}

/** What the seat to act may do right now. */
export function legalActions(s: HoldemState): LegalActions {
  if (s.over || s.toAct === null) return NO_ACTIONS;
  const seat = s.seats[s.toAct];
  const toCall = s.currentBet - seat.bet;
  const cap = betCap(s);
  const raiseTo = Math.min(s.currentBet + betSize(s.street), cap);
  // An opening bet doesn't use up one of the raises.
  const raisesLeft = s.currentBet === 0 || s.raises < MAX_RAISES;
  const hasChipsToRaise = seat.stack > toCall;
  return {
    fold: toCall > 0,
    check: toCall === 0,
    call: toCall > 0,
    callAmount: toCall,
    raise: raisesLeft && raiseTo > s.currentBet && hasChipsToRaise,
    raiseTo,
    // All in ignores the fixed bet size and the raise limit, but never goes past what everyone can match.
    allIn: cap > s.currentBet && hasChipsToRaise,
    allInTo: cap,
  };
}

const seatsInHand = (s: HoldemState) => s.seats.map((x, i) => ({ x, i })).filter(({ x }) => !x.folded);

/** The next seat after `from` that still has to act this round, or null if the round is done. */
function nextToAct(s: HoldemState, from: number): number | null {
  for (let step = 1; step <= SEAT_COUNT; step++) {
    const i = (from + step) % SEAT_COUNT;
    const seat = s.seats[i];
    if (seat.folded || seat.stack === 0) continue; // folded, or all in and nothing left to decide
    if (!seat.acted || seat.bet < s.currentBet) return i;
  }
  return null;
}

/** Awards the pot to whoever is left (or the best hand), and ends the hand. */
function finish(s: HoldemState, showdown: boolean): HoldemState {
  const alive = seatsInHand(s);
  const handNames: (string | null)[] = [null, null, null];
  let winners: number[];

  if (alive.length === 1) {
    winners = [alive[0].i];
  } else {
    const scored = alive.map(({ x, i }) => ({ i, hand: bestHand([...x.hole, ...s.board]) }));
    for (const { i, hand } of scored) handNames[i] = hand.name;
    const top = scored.reduce((best, cur) => (compareScores(cur.hand.score, best.hand.score) > 0 ? cur : best));
    winners = scored.filter(({ hand }) => compareScores(hand.score, top.hand.score) === 0).map(({ i }) => i);
  }

  // Split evenly. Any odd chips go to the winners closest to the left of the button.
  const ordered = [...winners].sort((a, b) => ((a - s.button - 1 + SEAT_COUNT) % SEAT_COUNT) - ((b - s.button - 1 + SEAT_COUNT) % SEAT_COUNT));
  const share = Math.floor(s.pot / winners.length);
  const payouts = [0, 0, 0];
  ordered.forEach((seat, n) => {
    payouts[seat] = share + (n < s.pot - share * winners.length ? 1 : 0);
  });

  const seats = s.seats.map((x, i) => ({ ...x, stack: x.stack + payouts[i] }));
  const verb = winners.length > 1 ? 'split the pot' : 'wins the pot';
  const names = winners.map((w) => `seat ${w}`).join(' and ');
  return {
    ...s,
    seats,
    street: showdown ? 'showdown' : s.street,
    toAct: null,
    over: true,
    winners,
    payouts,
    handNames,
    log: [...s.log, `${names} ${verb} (${s.pot}).`],
  };
}

const NEXT_STREET: Record<string, Street> = { preflop: 'flop', flop: 'turn', turn: 'river', river: 'showdown' };
const CARDS_DEALT: Record<string, number> = { flop: 3, turn: 1, river: 1 };

/** Moves on to the next street, or all the way to showdown when nobody has chips left to bet. */
function advance(s: HoldemState): HoldemState {
  let state = s;
  for (;;) {
    const next = NEXT_STREET[state.street];
    if (next === 'showdown') return finish(state, true);

    let rest = state.deck;
    const dealt: Card[] = [];
    for (let i = 0; i < CARDS_DEALT[next]; i++) {
      const [card, remaining] = drawCard(rest);
      rest = remaining;
      dealt.push(card);
    }
    state = {
      ...state,
      street: next,
      deck: rest,
      board: [...state.board, ...dealt],
      seats: state.seats.map((x) => ({ ...x, bet: 0, acted: false })),
      currentBet: 0,
      raises: 0,
      log: [...state.log, `Dealt the ${next}.`],
    };

    // First to act is the first live seat with chips to the left of the button.
    const first = nextToAct(state, state.button);
    if (first !== null) {
      // Betting only happens if two seats can bet, and nobody is all in (a bet must be matchable by everyone).
      const canBet = state.seats.filter((x) => !x.folded && x.stack > 0).length;
      if (canBet >= 2 && betCap(state) > 0) return { ...state, toAct: first };
    }
    // Otherwise everyone left is all in (or alone with chips): deal out the rest of the board.
  }
}

/** Applies the seat-to-act's action. Illegal actions leave the state unchanged. */
export function act(s: HoldemState, action: Action): HoldemState {
  if (s.over || s.toAct === null) return s;
  const legal = legalActions(s);
  const who = s.toAct;
  const seat = s.seats[who];

  let seats = s.seats.map((x) => ({ ...x }));
  let { pot, currentBet, raises } = s;
  let note: string;

  if (action === 'fold') {
    if (!legal.fold) return s;
    seats[who].folded = true;
    seats[who].acted = true;
    note = `Seat ${who} folds.`;
  } else if (action === 'check') {
    if (!legal.check) return s;
    seats[who].acted = true;
    note = `Seat ${who} checks.`;
  } else if (action === 'call') {
    if (!legal.call) return s;
    const amount = Math.min(legal.callAmount, seat.stack);
    seats[who].stack -= amount;
    seats[who].bet += amount;
    seats[who].totalIn += amount;
    seats[who].acted = true;
    pot += amount;
    note = `Seat ${who} calls ${amount}.`;
  } else if (action === 'raise' || action === 'allin') {
    const allIn = action === 'allin';
    if (!(allIn ? legal.allIn : legal.raise)) return s;
    const target = allIn ? legal.allInTo : legal.raiseTo;
    const amount = target - seat.bet;
    const opening = currentBet === 0;
    seats[who].stack -= amount;
    seats[who].bet = target;
    seats[who].totalIn += amount;
    pot += amount;
    currentBet = target;
    if (!opening) raises += 1;
    // Everyone else gets to respond to the raise.
    seats = seats.map((x, i) => (i === who ? { ...x, acted: true } : { ...x, acted: x.folded || x.stack === 0 ? x.acted : false }));
    if (allIn) note = `Seat ${who} goes all in (${target}).`;
    else note = opening ? `Seat ${who} bets ${target}.` : `Seat ${who} raises to ${target}.`;
  } else {
    return s;
  }

  const next: HoldemState = { ...s, seats, pot, currentBet, raises, log: [...s.log, note] };

  if (seatsInHand(next).length === 1) return finish(next, false);

  const upNext = nextToAct(next, who);
  if (upNext !== null) return { ...next, toAct: upNext };
  return advance(next);
}
