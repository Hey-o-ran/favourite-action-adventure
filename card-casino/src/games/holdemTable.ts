import { handText, translate, type MessageKey, type Translate } from '../i18n';
import { BIG_BLIND, BUY_IN, SEAT_COUNT, type HoldemState } from './holdemRules';

/** British English unless a translator is passed in, so callers and tests that don't care about language still work. */
const english: Translate = (key, values) => translate('en-GB', key, values);

/** Seat 0 is always the human player. */
export const SEAT_NAMES = ['You', 'Bot 1', 'Bot 2'];
const SEAT_KEYS: MessageKey[] = ['seat.you', 'seat.bot1', 'seat.bot2'];
export const seatName = (seat: number, t: Translate = english) => t(SEAT_KEYS[seat]);

export interface NextHand {
  /** Chips each seat starts the next hand with. */
  stacks: number[];
  button: number;
  /** Bots that ran out of chips and bought back in at the full buy-in. */
  rebought: number[];
  /** The human can't cover the big blind, so they can't be dealt in again. */
  humanBust: boolean;
}

/** Carries stacks over to the next hand: the button moves on and bust bots buy back in. */
export function nextHandSetup(finished: HoldemState): NextHand {
  const stacks = finished.seats.map((seat) => seat.stack);
  const rebought: number[] = [];
  for (let seat = 1; seat < SEAT_COUNT; seat++) {
    if (stacks[seat] < BIG_BLIND) {
      stacks[seat] = BUY_IN;
      rebought.push(seat);
    }
  }
  return { stacks, button: (finished.button + 1) % SEAT_COUNT, rebought, humanBust: stacks[0] < BIG_BLIND };
}

/** One line of the engine's log ("Seat 1 calls 2.") as a player-facing sentence, or undefined if it is not one we know. */
function describeLine(line: string, t: Translate): string | undefined {
  const name = (n: string) => seatName(Number(n), t);
  const you = (n: string) => Number(n) === 0;
  let m: RegExpMatchArray | null;

  if ((m = line.match(/^Seat (\d) posts the small blind, seat (\d) the big blind\.$/))) {
    if (you(m[1])) return t('holdem.log.blindsYouSmall', { big: name(m[2]) });
    if (you(m[2])) return t('holdem.log.blindsYouBig', { small: name(m[1]) });
    return t('holdem.log.blinds', { small: name(m[1]), big: name(m[2]) });
  }
  if ((m = line.match(/^Seat (\d) (folds|checks)\.$/))) {
    const key = m[2] === 'folds' ? 'fold' : 'check';
    return you(m[1]) ? t(`holdem.log.${key}You` as MessageKey) : t(`holdem.log.${key}` as MessageKey, { who: name(m[1]) });
  }
  if ((m = line.match(/^Seat (\d) calls (\d+)\.$/))) {
    return you(m[1]) ? t('holdem.log.callYou', { amount: m[2] }) : t('holdem.log.call', { who: name(m[1]), amount: m[2] });
  }
  if ((m = line.match(/^Seat (\d) bets (\d+)\.$/))) {
    return you(m[1]) ? t('holdem.log.betYou', { amount: m[2] }) : t('holdem.log.bet', { who: name(m[1]), amount: m[2] });
  }
  if ((m = line.match(/^Seat (\d) raises to (\d+)\.$/))) {
    return you(m[1]) ? t('holdem.log.raiseYou', { amount: m[2] }) : t('holdem.log.raise', { who: name(m[1]), amount: m[2] });
  }
  if ((m = line.match(/^Seat (\d) goes all in \((\d+)\)\.$/))) {
    return you(m[1]) ? t('holdem.log.allInYou', { amount: m[2] }) : t('holdem.log.allIn', { who: name(m[1]), amount: m[2] });
  }
  if ((m = line.match(/^Dealt the (flop|turn|river)\.$/))) {
    return t('holdem.log.dealt', { street: t(`streetLower.${m[1]}` as MessageKey) });
  }
  return undefined;
}

const YOU_VERBS: Record<string, string> = { folds: 'fold', checks: 'check', calls: 'call', bets: 'bet', raises: 'raise', posts: 'post', goes: 'go' };

/** Turns the engine's log ("Seat 1 calls 2.") into player-facing lines ("Bot 1 calls 2.", "You call 2."). */
export function formatLog(lines: readonly string[], t: Translate = english): string[] {
  return lines
    .filter((line) => !/(wins|split) the pot/.test(line)) // the result is shown separately
    .map(
      (line) =>
        describeLine(line, t) ??
        // A line we have no wording for is shown in English rather than lost.
        line
          .replace(/[Ss]eat (\d)/g, (_, n: string) => seatName(Number(n), t))
          .replace(/^You (folds|checks|calls|bets|raises|posts|goes)\b/, (_, verb: string) => `You ${YOU_VERBS[verb]}`)
          .replace(/, You\b/, ', you'),
    );
}

/** A sentence about how the finished hand ended, and how many chips you gained or lost. */
export function describeResult(s: HoldemState, t: Translate = english): { text: string; net: number } {
  const net = s.payouts[0] - s.seats[0].totalIn;
  const showdown = s.street === 'showdown';
  const hand = (seat: number) => handText(t, s.handNames[seat] ?? '');

  let text: string;
  if (s.winners.length > 1) {
    const names = s.winners.map((w) => seatName(w, t)).join(t('holdem.and'));
    text = showdown
      ? t('holdem.res.splitShow', { names, pot: s.pot, hand: hand(s.winners[0]) })
      : t('holdem.res.split', { names, pot: s.pot });
  } else {
    const winner = s.winners[0];
    if (winner === 0) {
      text = showdown ? t('holdem.res.youWinShow', { pot: s.pot, hand: hand(winner) }) : t('holdem.res.youWinFolded', { pot: s.pot });
    } else {
      const name = seatName(winner, t);
      text = showdown ? t('holdem.res.winShow', { name, pot: s.pot, hand: hand(winner) }) : t('holdem.res.winFolded', { name, pot: s.pot });
    }
  }
  return { text, net };
}
