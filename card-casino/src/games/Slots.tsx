import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { ApiError, getRankedBalance, spinRankedSlots, type BalanceResponse } from '../api';
import { useI18n } from '../i18n';
import { useWinMark } from '../bigWins';
import { BetPanel } from '../components/BetPanel';
import { GlaggleFace, GlaggleRow } from '../components/GlaggleFace';
import {
  REELS,
  STOPS,
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
  if (a === b && b === c) return `Three ${SYMBOL_NAME[a]}s!`;
  return `Two ${SYMBOL_NAME.cherry}s!`;
}

interface RankedSlotsOptions {
  userId: string;
  token: string;
  active: boolean;
  onUnauthorized(): void;
}

export function Slots({ ranked }: { ranked?: RankedSlotsOptions } = {}) {
  const { balance: practiceBalance, wager, settle } = useWallet();
  const { lang } = useI18n();
  const chinese = lang === 'zh-CN';
  const [rankedWallet, setRankedWallet] = useState<BalanceResponse>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const activeRequest = useRef(false);
  const pending = useRef<{ bet: number; spinId: string }>();
  const storageKey = ranked ? `card-casino.pending-ranked-spin.${ranked.userId}` : '';
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    pending.current = undefined;
    setStorageError(false);
    if (!ranked) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (!saved || typeof saved !== 'object' || typeof (saved as { spinId?: unknown }).spinId !== 'string' || !Number.isSafeInteger((saved as { bet?: unknown }).bet) || Number((saved as { bet: number }).bet) <= 0) throw new Error('Invalid pending spin');
        pending.current = saved as { bet: number; spinId: string };
        setError(chinese ? '\u4e0a\u6b21\u65cb\u8f6c\u672a\u786e\u8ba4\uff0c\u8bf7\u91cd\u8bd5\u3002' : 'A previous spin needs confirmation. Retry to get its result.');
      }
    } catch { setStorageError(true); }
  }, [storageKey]);
  const token = ranked?.token;
  const onUnauthorized = ranked?.onUnauthorized;
  const active = ranked?.active;
  const balance = ranked ? rankedWallet?.balance ?? 0 : practiceBalance;
  const updateRankedWallet = (wallet: BalanceResponse) =>
    setRankedWallet((previous) => previous && previous.version > wallet.version ? previous : wallet);

  useEffect(() => {
    if (!token || !active) return;
    let ignore = false;
    setLoading(true);
    void getRankedBalance(token).then((wallet) => {
      if (ignore) return;
      updateRankedWallet(wallet);
      if (!pending.current) setError('');
    }).catch((err: unknown) => {
      if (ignore) return;
      if (err instanceof ApiError && err.status === 401) onUnauthorized?.();
      else setError(chinese ? '无法加载排位余额。' : 'Could not load the ranked balance.');
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, [active, token, retry, onUnauthorized, chinese]);
  const { markWin } = useWinMark();
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

  const [requesting, setRequesting] = useState(false);
  const busy = requesting || spinning.some(Boolean);

  const animate = (stops: readonly number[], staked: number, returned: number) => {
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
          setResult({ bet: staked, returned, line: lineAt(stops) });
          if (ranked) {
            try { localStorage.removeItem(storageKey); pending.current = undefined; } catch { setStorageError(true); }
          }
          if (!ranked) {
            if (lineAt(stops).every((s) => s === 'seven')) markWin('slotsJackpot');
            settle(returned);
          }
        }, at),
      );
    });
  };

  const spin = async () => {
    if (busy || activeRequest.current) return;
    if (!ranked) {
      if (!wager(bet)) return;
      const stops = stopsFor(() => Math.random());
      animate(stops, bet, returnedFor(bet, stops));
      return;
    }

    activeRequest.current = true;
    setRequesting(true);
    setError('');
    try {
      const request = pending.current ?? { bet, spinId: crypto.randomUUID() };
      if (!pending.current) {
        try { localStorage.setItem(storageKey, JSON.stringify(request)); } catch { setStorageError(true); return; }
      }
      pending.current = request;
      const result = await spinRankedSlots(ranked.token, request);
      updateRankedWallet(result);
      animate(result.stops, result.bet, result.returned);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized?.();
      } else if (err instanceof ApiError && err.code === 'BALANCE_OUT_OF_RANGE') {
        localStorage.removeItem(storageKey);
        pending.current = undefined;
        const { balance, version } = err.details ?? {};
        if (typeof balance === 'number' && typeof version === 'number') updateRankedWallet({ balance, version });
        setError(chinese ? '排位金币不足。' : 'You do not have enough ranked coins.');
      } else {
        setError(chinese ? '无法确认这次旋转。请重试。' : 'Could not confirm this spin. Retry to get its result.');
      }
    } finally {
      activeRequest.current = false;
      setRequesting(false);
    }
  };

  const won = result !== null && result.returned > 0;

  return (
    <section className="table slots">
      <h2>Slots</h2>
      {ranked && (
        <p aria-live="polite">
          {rankedWallet
            ? (chinese ? '排位金币：' : 'Ranked coins: ') + balance.toLocaleString(lang)
            : loading ? (chinese ? '正在加载排位余额…' : 'Loading ranked balance…') : null}
        </p>
      )}
      {storageError && <p role="alert">{chinese ? '\u65e0\u6cd5\u4fdd\u5b58\u65cb\u8f6c\u8bb0\u5f55\uff0c\u6392\u4f4d\u6a21\u5f0f\u4e0d\u53ef\u7528\u3002' : 'Ranked play requires browser storage to recover interrupted spins.'}</p>}
      {ranked && <p>{chinese ? '\u4e0d\u8d25\u4fdd\u62a4\u53ea\u9002\u7528\u4e8e\u7ec3\u4e60\u6e38\u620f\uff0c\u4e0d\u9002\u7528\u4e8e\u6392\u4f4d\u8001\u864e\u673a\u3002' : 'Unloseable protection applies to practice games, not ranked Slots.'}</p>}
      {error && <p role="alert">{error}</p>}
      {ranked && error && !rankedWallet && (
        <button type="button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>
          {chinese ? '重新加载余额' : 'Reload balance'}
        </button>
      )}

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
                  <GlaggleFace symbol={symbol} decorative />
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
        <button className="primary" onClick={spin} disabled={storageError || busy || (!pending.current && balance < bet)}>
          {busy ? 'Spinning…' : pending.current ? (chinese ? '重试旋转' : 'Retry spin') : `Spin · ${bet} coins`}
        </button>
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={busy || Boolean(pending.current)} />

      <table className="sl-paytable">
        <caption>What the middle line pays: coins back for every coin you bet</caption>
        <tbody>
          {PAYTABLE_ORDER.map((symbol) => (
            <tr key={symbol}>
              <th scope="row">
                <span aria-hidden="true">
                  <GlaggleRow symbol={symbol} count={3} decorative />
                </span>
                <span className="sr-only">Three {SYMBOL_NAME[symbol]}s</span>
              </th>
              <td>{THREE_OF_A_KIND[symbol]}×</td>
            </tr>
          ))}
          <tr>
            <th scope="row">
              <span aria-hidden="true">
                <GlaggleRow symbol="cherry" count={2} decorative /> any
              </span>
              <span className="sr-only">Any two {SYMBOL_NAME.cherry}s</span>
            </th>
            <td>{TWO_CHERRIES}×</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
