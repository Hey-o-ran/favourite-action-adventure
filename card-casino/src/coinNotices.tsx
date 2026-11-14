import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, dismissNotice as sendDismiss, listNotices, type CoinNotice } from './api';
import { POLL_MS } from './abuseEvents';
import { useSession } from './session';
import { useWallet } from './wallet';

export interface CoinNoticesValue {
  /** Messages the player has not dismissed yet, oldest first. */
  notices: CoinNotice[];
  dismiss: (noticeId: string) => void;
}

// Without a provider (in tests, or before login) there are simply no messages.
const IDLE: CoinNoticesValue = { notices: [], dismiss: () => {} };
const CoinNoticesContext = createContext<CoinNoticesValue>(IDLE);

export const useCoinNotices = () => useContext(CoinNoticesContext);

/**
 * Tells the player when an admin sends or removes coins. It polls for messages, shows each until the player
 * dismisses it, and refreshes the balance once per message so the number on screen matches the message.
 */
export function CoinNoticesProvider({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const wallet = useWallet();

  // Latest values for the callbacks below, which must not change identity (they sit in effects and timers).
  const tokenRef = useRef(session.idToken);
  tokenRef.current = session.idToken;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const refreshRef = useRef(wallet.refresh);
  refreshRef.current = wallet.refresh;

  const [notices, setNotices] = useState<CoinNotice[]>([]);
  /** Messages the balance has already been refreshed for, and ones dismissed here (the server may still list them for a moment). */
  const refreshedRef = useRef(new Set<string>());
  const dismissedRef = useRef(new Set<string>());

  const poll = useCallback(async () => {
    try {
      const list = (await listNotices(tokenRef.current)).notices.filter((n) => !dismissedRef.current.has(n.noticeId));
      setNotices(list);
      const fresh = list.filter((n) => !refreshedRef.current.has(n.noticeId));
      if (fresh.length > 0) {
        for (const n of fresh) refreshedRef.current.add(n.noticeId);
        await refreshRef.current();
      }
    } catch (err) {
      // A rejected login means logging in again. Anything else is quiet: messages are retried on the next poll.
      if (err instanceof ApiError && err.status === 401) logoutRef.current();
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const dismiss = useCallback((noticeId: string) => {
    dismissedRef.current.add(noticeId);
    setNotices((list) => list.filter((n) => n.noticeId !== noticeId));
    // If this fails the message may come back after a reload, which is harmless.
    sendDismiss(tokenRef.current, noticeId).catch((err) => {
      if (err instanceof ApiError && err.status === 401) logoutRef.current();
    });
  }, []);

  const value = useMemo<CoinNoticesValue>(() => ({ notices, dismiss }), [notices, dismiss]);
  return <CoinNoticesContext.Provider value={value}>{children}</CoinNoticesContext.Provider>;
}
