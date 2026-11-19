import { botBid, botPlay } from './landlordBots';
import {
  bid,
  deal,
  forfeitRound,
  legalBids,
  pass,
  play,
  scoreRound,
  startBidding,
  startRound,
  type BidState,
  type LCard,
  type Round,
  type RuleOptions,
} from './landlordRules';

/*
 * One table of Landlord from the player's side: the deal, the bidding, the round and what it pays. The screen only shows
 * this and passes on what the player does, and the bots take their turns one step at a time so the player can follow.
 * Every function returns the same table, untouched, when what is asked is not allowed.
 */

/** You always sit in seat 0; the bots are seats 1 and 2. */
export const YOU = 0;

export type Phase = 'bidding' | 'playing' | 'over';

export interface Table {
  phase: Phase;
  /** What the player staked on this round. */
  bet: number;
  /** The rules this round is played with. A round keeps them even if the switches are changed later. */
  options: RuleOptions;
  /** The cards as dealt, 17 each. The landlord's three extra cards are added when the round starts. */
  hands: LCard[][];
  /** The three cards the landlord takes, shown to everyone once the bidding is over. */
  bottom: LCard[];
  bidding: BidState;
  round: Round | null;
  /** How many times everybody passed and the cards were dealt again. */
  redeals: number;
  /** Whether you played the rocket, for the big win announcement. */
  youPlayedRocket: boolean;
}

export function startTable(bet: number, options: RuleOptions, deck: readonly LCard[], first: number): Table {
  const { hands, bottom } = deal(deck);
  return { phase: 'bidding', bet, options, hands, bottom, bidding: startBidding(first), round: null, redeals: 0, youPlayedRocket: false };
}

/** Everybody passed: deal again, with the same bet and nothing more to pay. */
export function redeal(table: Table, deck: readonly LCard[], first: number): Table {
  if (table.phase !== 'bidding' || !table.bidding.redeal) return table;
  const { hands, bottom } = deal(deck);
  return { ...table, hands, bottom, bidding: startBidding(first), redeals: table.redeals + 1 };
}

/** Once the bidding is over, either deal again (nobody bid) or start the round with the winning bidder as landlord. */
function afterBid(table: Table, bidding: BidState): Table {
  if (!bidding.done || bidding.redeal || bidding.landlord === null) return { ...table, bidding };
  return { ...table, bidding, phase: 'playing', round: startRound(table.hands, table.bottom, bidding.landlord, bidding.value, table.options) };
}

/** You bid 0 (pass), 1, 2 or 3, if it is your turn and the bid is allowed. */
export function playerBid(table: Table, amount: number): Table {
  if (table.phase !== 'bidding' || table.bidding.done || table.bidding.turn !== YOU || !legalBids(table.bidding).includes(amount)) return table;
  return afterBid(table, bid(table.bidding, amount));
}

const finished = (table: Table, round: Round): Table => ({ ...table, round, phase: round.winner === null ? 'playing' : 'over' });

/** You play these cards, if it is your turn and the rules allow them. */
export function playerPlay(table: Table, cards: readonly LCard[]): Table {
  const round = table.round;
  if (table.phase !== 'playing' || !round || round.turn !== YOU) return table;
  const next = play(round, cards);
  if (next === round) return table;
  return { ...finished(table, next), youPlayedRocket: table.youPlayedRocket || next.last?.combo.kind === 'rocket' };
}

/** You pass, if it is your turn and there is a play to pass on. */
export function playerPass(table: Table): Table {
  const round = table.round;
  if (table.phase !== 'playing' || !round || round.turn !== YOU) return table;
  const next = pass(round);
  return next === round ? table : finished(table, next);
}

/** The bot whose turn it is takes it: a bid or a play. Nothing happens when it is your turn, or the round is over. */
export function botStep(table: Table): Table {
  if (table.phase === 'bidding') {
    const { bidding } = table;
    if (bidding.done || bidding.turn === YOU) return table;
    return afterBid(table, bid(bidding, botBid(table.hands[bidding.turn], bidding.value)));
  }
  const round = table.round;
  if (table.phase !== 'playing' || !round || round.turn === YOU) return table;
  const chosen = botPlay(round, round.turn);
  return finished(table, chosen ? play(round, chosen) : pass(round));
}

/** You give up the round: your side loses, at the multiplier so far. */
export function giveUp(table: Table): Table {
  if (table.phase !== 'playing' || !table.round) return table;
  return finished(table, forfeitRound(table.round, YOU));
}

export interface Settlement {
  won: boolean;
  multiplier: number;
  /** Coins handed back: the bet and the winnings. Zero after a loss. */
  returned: number;
  /** What a loss costs on top of the bet, limited to what the player has left so the balance never goes below zero. */
  extra: number;
}

/** What the finished round pays. `balance` is what the player has left after staking the bet. */
export function settlementOf(table: Table, balance: number): Settlement {
  if (!table.round) throw new Error('The round has not started');
  const score = scoreRound(table.round, table.bet, YOU);
  return { won: score.won, multiplier: score.multiplier, returned: score.returned, extra: Math.min(score.extraLoss, Math.max(balance, 0)) };
}
