import { BIG_BLIND, BUY_IN, SEAT_COUNT, type HoldemState } from './holdemRules';

/** Seat 0 is always the human player. */
export const SEAT_NAMES = ['You', 'Bot 1', 'Bot 2'];
export const seatName = (seat: number) => SEAT_NAMES[seat];

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

const YOU_VERBS: Record<string, string> = { folds: 'fold', checks: 'check', calls: 'call', bets: 'bet', raises: 'raise', posts: 'post' };

/** Turns the engine's log ("Seat 1 calls 2.") into player-facing lines ("Bot 1 calls 2.", "You call 2."). */
export function formatLog(lines: readonly string[]): string[] {
  return lines
    .filter((line) => !/(wins|split) the pot/.test(line)) // the result is shown separately
    .map((line) =>
      line
        .replace(/[Ss]eat (\d)/g, (_, n: string) => seatName(Number(n)))
        .replace(/^You (folds|checks|calls|bets|raises|posts)\b/, (_, verb: string) => `You ${YOU_VERBS[verb]}`)
        .replace(/, You\b/, ', you'),
    );
}

/** A sentence about how the finished hand ended, and how many chips you gained or lost. */
export function describeResult(s: HoldemState): { text: string; net: number } {
  const net = s.payouts[0] - s.seats[0].totalIn;
  const names = s.winners.map(seatName);
  const handNote = s.street === 'showdown' && s.winners.length === 1 ? ` with ${s.handNames[s.winners[0]]}` : '';

  let text: string;
  if (s.winners.length > 1) {
    text = `${names.join(' and ')} split the pot of ${s.pot}${s.street === 'showdown' ? ` (${s.handNames[s.winners[0]]})` : ''}.`;
  } else {
    const verb = s.winners[0] === 0 ? 'win' : 'wins';
    text = `${names[0]} ${verb} ${s.pot}${handNote}${s.street === 'showdown' ? '' : ' (everyone else folded)'}.`;
  }
  return { text, net };
}
