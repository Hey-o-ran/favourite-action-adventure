import { SUITS, SUIT_SYMBOL, rankLabel, shuffle, type Card, type Suit } from '../cards';

export const HAND_SIZE = 7;
/** Profit per coin staked for winning the round. */
export const WIN_PAYOUT = 1;
const EIGHT = 8;

type Who = 'player' | 'bot';

export interface CrazyEightsState {
  stock: Card[];
  /** The last card is the top of the pile. */
  discard: Card[];
  player: Card[];
  bot: Card[];
  /** The suit that must be matched. It differs from the top card's suit after an 8 is played. */
  suit: Suit;
  turn: Who;
  /** 'draw' means neither side could move and the stock ran out, so the bet is returned. */
  status: 'playing' | 'won' | 'lost' | 'draw';
  /** Turns in a row where nobody could play and nothing was left to draw. */
  passes: number;
  bet: number;
  /** A short description of the last move, for the screen. */
  log: string;
}

export const topCard = (s: CrazyEightsState) => s.discard[s.discard.length - 1];

/** A card can be played if it matches the suit in force or the top card's rank. An 8 is always playable. */
export const isPlayable = (card: Card, s: CrazyEightsState) =>
  card.rank === EIGHT || card.suit === s.suit || card.rank === topCard(s).rank;

export const cardName = (card: Card) => `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;

/** Coins handed back, including the stake. */
export function returnedFor(s: CrazyEightsState): number {
  if (s.status === 'won') return s.bet * (1 + WIN_PAYOUT);
  if (s.status === 'draw') return s.bet;
  return 0;
}

/** The suit held most often in `hand`, used when choosing what an 8 should become. Ties go to the first suit. */
export function bestSuit(hand: readonly Card[], fallback: Suit): Suit {
  if (hand.length === 0) return fallback;
  const counts = new Map<Suit, number>();
  for (const card of hand) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  return SUITS.reduce((best, suit) => ((counts.get(suit) ?? 0) > (counts.get(best) ?? 0) ? suit : best), SUITS[0]);
}

/** Deals 7 cards each, alternating, then turns up a starter card. An 8 can't start, so it goes to the bottom. */
export function startCrazyEights(deck: readonly Card[], bet: number): CrazyEightsState {
  const stock = [...deck];
  const player: Card[] = [];
  const bot: Card[] = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    player.push(stock.shift()!);
    bot.push(stock.shift()!);
  }
  let starter = stock.shift()!;
  while (starter.rank === EIGHT) {
    stock.push(starter);
    starter = stock.shift()!;
  }
  return {
    stock,
    discard: [starter],
    player,
    bot,
    suit: starter.suit,
    turn: 'player',
    status: 'playing',
    passes: 0,
    bet,
    log: 'Your turn.',
  };
}

/** When the stock runs out, the pile under the top card is shuffled to make a new one. */
function refill(s: CrazyEightsState): CrazyEightsState {
  if (s.stock.length > 0 || s.discard.length <= 1) return s;
  return { ...s, stock: shuffle(s.discard.slice(0, -1)), discard: [topCard(s)] };
}

/** Draws until a playable card turns up, or there is nothing left to draw. */
function drawUntilPlayable(s: CrazyEightsState, who: Who): { state: CrazyEightsState; drawn: number; found: boolean } {
  let state = s;
  let drawn = 0;
  for (;;) {
    state = refill(state);
    if (state.stock.length === 0) return { state, drawn, found: false };
    const [card, ...rest] = state.stock;
    state = { ...state, stock: rest, [who]: [...state[who], card] };
    drawn++;
    if (isPlayable(card, state)) return { state, drawn, found: true };
  }
}

/** Nobody could move: pass the turn, and call it a draw once both sides have passed in a row. */
function pass(s: CrazyEightsState, next: Who, log: string): CrazyEightsState {
  const passes = s.passes + 1;
  return { ...s, turn: next, passes, status: passes >= 2 ? 'draw' : s.status, log };
}

const plural = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

/** Plays the card at `index`. For an 8, `chosenSuit` becomes the suit in force. */
export function playCard(s: CrazyEightsState, index: number, chosenSuit?: Suit): CrazyEightsState {
  if (s.status !== 'playing' || s.turn !== 'player') return s;
  const card = s.player[index];
  if (!card || !isPlayable(card, s)) return s;

  const hand = s.player.filter((_, i) => i !== index);
  const suit = card.rank === EIGHT ? (chosenSuit ?? bestSuit(hand, card.suit)) : card.suit;
  const next: CrazyEightsState = {
    ...s,
    player: hand,
    discard: [...s.discard, card],
    suit,
    passes: 0,
    log: card.rank === EIGHT ? `You played ${cardName(card)} and chose ${SUIT_SYMBOL[suit]}.` : `You played ${cardName(card)}.`,
  };
  return hand.length === 0 ? { ...next, status: 'won' } : { ...next, turn: 'bot' };
}

/** Draws for the player, but only when they have nothing to play. Passes the turn if nothing playable turns up. */
export function drawForPlayer(s: CrazyEightsState): CrazyEightsState {
  if (s.status !== 'playing' || s.turn !== 'player') return s;
  if (s.player.some((c) => isPlayable(c, s))) return s;

  const { state, drawn, found } = drawUntilPlayable(s, 'player');
  if (found) return { ...state, passes: 0, log: `You drew ${plural(drawn)}.` };
  return pass(state, 'bot', drawn > 0 ? `You drew ${plural(drawn)} but still can't play. You pass.` : "Nothing left to draw. You pass.");
}

/** The bot's whole turn. It plays ordinary cards first, saves its 8s, and picks the suit it holds most of. */
export function botTurn(s: CrazyEightsState): CrazyEightsState {
  if (s.status !== 'playing' || s.turn !== 'bot') return s;

  let state = s;
  let drawn = 0;
  if (!state.bot.some((c) => isPlayable(c, state))) {
    const result = drawUntilPlayable(state, 'bot');
    state = result.state;
    drawn = result.drawn;
  }

  const playable = state.bot.map((card, index) => ({ card, index })).filter(({ card }) => isPlayable(card, state));
  const drawnNote = drawn > 0 ? `Bot drew ${plural(drawn)}${playable.length ? ' and played' : " and can't play. It passes"}` : '';
  if (playable.length === 0) return pass(state, 'player', drawnNote ? `${drawnNote}.` : 'Bot passes.');

  const ordinary = playable.filter(({ card }) => card.rank !== EIGHT);
  const pool = ordinary.length > 0 ? ordinary : playable;
  // Prefer the card from the suit it holds most of, so it keeps matching later.
  const favoured = bestSuit(state.bot, state.suit);
  const choice = pool.find(({ card }) => card.suit === favoured) ?? pool[0];

  const hand = state.bot.filter((_, i) => i !== choice.index);
  const suit = choice.card.rank === EIGHT ? bestSuit(hand, choice.card.suit) : choice.card.suit;
  const played = choice.card.rank === EIGHT ? `${cardName(choice.card)} and chose ${SUIT_SYMBOL[suit]}` : cardName(choice.card);
  const next: CrazyEightsState = {
    ...state,
    bot: hand,
    discard: [...state.discard, choice.card],
    suit,
    passes: 0,
    log: drawnNote ? `${drawnNote} ${played}.` : `Bot played ${played}.`,
  };
  return hand.length === 0 ? { ...next, status: 'lost' } : { ...next, turn: 'player' };
}
