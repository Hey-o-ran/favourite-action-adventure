import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { BetPanel } from '../components/BetPanel';
import {
  REELS,
  STOPS,
  SYMBOL_EMOJI,
  SYMBOL_NAME,
  THREE_OF_A_KIND,
  TWO_CHERRIES,
  lineAt,
  lineReturn,
  returnedFor,
  stopsFor,
  windowAt,
  type SlotSymbol,
} from './slotsRules';

/** When each reel stops, in milliseconds after the spin starts: left to right, a little apart. */
export const STOP_AT_MS = [900, 1450, 2000] as const;
/** How often the spinning reels move on by one symbol. */
const TICK_MS = 70;

const PAYTABLE_ORDER: SlotSymbol[] = ['seven', 'diamond', 'bell', 'grape', 'lemon', 'cherry'];

/** Says what the winning line was, for the screen. */
function describeWin(line: ReturnType<typeof lineAt>): string {
  const [a, b, c] = line;
  if (a === b && b === c) return `Three ${SYMBOL_NAME[a]}!`;
  return 'Two cherries!';
}

export function Slots() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  /** Where each reel is showing. While a reel spins this moves on by one every tick. */
  const [shown, setShown] = useState<number[]>([0, 7, 13]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [result, setResult] = useState<{ bet: number; returned: number; line: ReturnType<typeof lineAt> } | null>(null);
  const timers = useRef<number[]>([]);
  const ticker = useRef<number>();
  /** Which reels are still turning, kept in a ref so the ticker always sees the latest. */
  const turning = useRef<boolean[]>([false, false, false]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    window.clearInterval(ticker.current);
  };
  useEffect(() => clearTimers, []);

  const busy = spinning.some(Boolean);

  const spin = () => {
    if (busy || !wager(bet)) return;
    // The result is decided now. The reels only take their time to show it.
    const stops = stopsFor(() => Math.random());
    const staked = bet;
    turning.current = [true, true, true];
    setSpinning([true, true, true]);
    setResult(null);

    ticker.current = window.setInterval(() => {
      setShown((s) => s.map((position, i) => (turning.current[i] ? (position + 1) % STOPS : position)));
    }, TICK_MS);

    STOP_AT_MS.forEach((at, i) => {
      timers.current.push(
        window.setTimeout(() => {
          turning.current[i] = false;
          setShown((s) => s.map((position, j) => (j === i ? stops[i] : position)));
          setSpinning([...turning.current]);
          if (i < REELS - 1) return;
          window.clearInterval(ticker.current);
          const returned = returnedFor(staked, stops);
          setResult({ bet: staked, returned, line: lineAt(stops) });
          // The wallet expects a settle for every wager, with 0 for a loss.
          settle(returned);
        }, at),
      );
    });
  };

  const won = result !== null && result.returned > 0;

  return (
    <section className="table slots">
      <h2>Slots</h2>

      <div className="sl-machine" role="group" aria-label="Slot machine reels">
        {shown.map((stop, i) => {
          const rows = windowAt(stop);
          return (
            <div
              key={i}
              className={`sl-reel${spinning[i] ? ' spinning' : ''}`}
              aria-label={
                spinning[i] ? `Reel ${i + 1}: spinning` : `Reel ${i + 1}: ${SYMBOL_NAME[rows[0]]} above, ${SYMBOL_NAME[rows[1]]} on the line, ${SYMBOL_NAME[rows[2]]} below`
              }
              role="img"
            >
              {rows.map((symbol, row) => (
                <div key={row} className={`sl-cell${row === 1 ? ' line' : ''}${row === 1 && won && !spinning[i] ? ' win' : ''}`} aria-hidden="true">
                  {SYMBOL_EMOJI[symbol]}
                </div>
              ))}
            </div>
          );
        })}
        <div className="sl-payline" aria-hidden="true" />
      </div>

      <p className="result" aria-live="polite">
        {busy && <>The reels are spinning…</>}
        {!busy && result === null && <>Choose your bet, then spin! Only the middle line pays.</>}
        {!busy && result && won && (
          <>
            {describeWin(result.line)} Pays {lineReturn(result.line)}× your bet:{' '}
            <span className="gain">+{result.returned - result.bet} coins</span>
          </>
        )}
        {!busy && result && !won && (
          <>
            No win. <span className="loss">-{result.bet} coins</span>
          </>
        )}
      </p>

      <div className="actions">
        <button className="primary" onClick={spin} disabled={busy || balance < bet}>
          {busy ? 'Spinning…' : `Spin · ${bet} coins`}
        </button>
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={busy} />

      <table className="sl-paytable">
        <caption>What the middle line pays: coins back for every coin you bet</caption>
        <tbody>
          {PAYTABLE_ORDER.map((symbol) => (
            <tr key={symbol}>
              <th scope="row">
                <span aria-hidden="true">{SYMBOL_EMOJI[symbol].repeat(3)}</span>
                <span className="sr-only">Three {SYMBOL_NAME[symbol]}</span>
              </th>
              <td>{THREE_OF_A_KIND[symbol]}×</td>
            </tr>
          ))}
          <tr>
            <th scope="row">
              <span aria-hidden="true">{SYMBOL_EMOJI.cherry}{SYMBOL_EMOJI.cherry} any</span>
              <span className="sr-only">Any two cherries</span>
            </th>
            <td>{TWO_CHERRIES}×</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
