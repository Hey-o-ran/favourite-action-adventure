import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { recordStats, reportWin, type GameResult, type StatsReport, type WinKind } from './api';
import { BIG_WIN_MULTIPLE, WinMarkContext, type WinMark } from './bigWins';
import { useSession } from './session';
import { WalletContext, useWallet, type WalletValue } from './wallet';

/*
 * Keeps the player's stats: how each game ended, and how long they really played. Both are sent to the server in the
 * background and never get in the way of the game: if a report fails it is simply not counted.
 */

/** More coins back than put in is a win, exactly the bet back is a draw, and less is a loss. */
export const outcomeOf = (staked: number, returned: number): GameResult => (returned > staked ? 'win' : returned === staked ? 'draw' : 'loss');

/** Sends a report and forgets about it. A failure is not worth bothering the player with. */
function send(token: string, report: StatsReport) {
  void recordStats(token, report).catch(() => {});
}

/**
 * Tells the server about a big win. The balance is saved first, because the server only announces a win its saved balance
 * backs up. A win the game marked is reported as that win; any other win of 50 times the bet or more as a big win.
 */
function announceWin(wallet: WalletValue, token: string, marked: WinKind | null, bet: number, prize: number) {
  if (prize <= 0) return;
  const win: WinKind | null = marked ?? (prize >= bet * BIG_WIN_MULTIPLE ? 'bigWin' : null);
  if (!win) return;
  void wallet
    .flush()
    .catch(() => {})
    .then(() => reportWin(token, { win, prize, bet }))
    .catch(() => {});
}

/**
 * Gives a game its own view of the wallet that notes how each round ends. The game wagers and settles exactly as before:
 * this adds up what was put in since the last settle (a round can have several bets, like a blackjack double) and, when
 * the round is settled, reports win, draw or loss for this game. A settle with nothing wagered behind it is not reported.
 */
export function GameScope({ gameId, children }: { gameId: string; children: ReactNode }) {
  const wallet = useWallet();
  const { session } = useSession();
  const staked = useRef(0);
  const marked = useRef<WinKind | null>(null);
  // The latest wallet and token, so a game holding on to an old wager or settle function still uses the current ones.
  const latest = useRef({ wallet, token: session.idToken });
  latest.current = { wallet, token: session.idToken };

  const scoped = useMemo<WalletValue>(
    () => ({
      ...wallet,
      wager(amount) {
        const ok = latest.current.wallet.wager(amount);
        if (ok) staked.current += amount;
        return ok;
      },
      settle(returned) {
        latest.current.wallet.settle(returned);
        const bet = staked.current;
        if (bet > 0) {
          send(latest.current.token, { game: gameId, result: outcomeOf(bet, returned) });
          announceWin(latest.current.wallet, latest.current.token, marked.current, bet, returned - bet);
        }
        staked.current = 0;
        marked.current = null;
      },
    }),
    [wallet, gameId],
  );

  const mark = useMemo<WinMark>(
    () => ({
      markWin(win) {
        marked.current = win;
      },
    }),
    [],
  );

  return (
    <WalletContext.Provider value={scoped}>
      <WinMarkContext.Provider value={mark}>{children}</WinMarkContext.Provider>
    </WalletContext.Provider>
  );
}

/** Seconds of play are sent in pieces of this size. */
export const REPORT_EVERY_SECONDS = 30;
/** Someone who has not touched anything for this long is not counted as playing. */
export const IDLE_AFTER_MS = 120_000;

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Counts the seconds the player really plays `gameId`: only while `enabled` (a game is on screen, not the rules or the
 * leaderboard), the tab is visible, and they have done something in the last two minutes. The seconds are reported every
 * 30, and what is left over is reported when they switch game, hide the tab or leave.
 */
export function usePlaytime(gameId: string, enabled: boolean) {
  const { session } = useSession();
  const token = useRef(session.idToken);
  token.current = session.idToken;
  const lastActive = useRef(Date.now());
  const pending = useRef({ game: gameId, seconds: 0 });
  const wasEnabled = useRef(enabled);
  wasEnabled.current = enabled;

  const flush = useCallback(() => {
    const { game, seconds } = pending.current;
    pending.current = { game, seconds: 0 };
    if (seconds >= 1) send(token.current, { game, seconds });
  }, []);

  // Switching game: whatever was counted so far belongs to the game being left.
  useEffect(() => {
    flush();
    pending.current = { game: gameId, seconds: 0 };
  }, [gameId, flush]);

  useEffect(() => {
    const touch = () => {
      lastActive.current = Date.now();
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touch, { passive: true });
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') flush();
      else touch();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const timer = window.setInterval(() => {
      if (!wasEnabled.current || document.visibilityState !== 'visible') return;
      if (Date.now() - lastActive.current > IDLE_AFTER_MS) return;
      pending.current.seconds += 1;
      if (pending.current.seconds >= REPORT_EVERY_SECONDS) flush();
    }, 1000);

    return () => {
      window.clearInterval(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touch);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [flush]);

  // Leaving the game screens (to the rules, say) hands in what has been counted.
  useEffect(() => {
    if (!enabled) flush();
  }, [enabled, flush]);
}
