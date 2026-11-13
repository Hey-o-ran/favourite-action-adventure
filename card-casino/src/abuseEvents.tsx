import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, claimEvent, listActiveEvents, type AbuseEvent } from './api';
import {
  clearProtection,
  isLive,
  loadProtection,
  loadSeen,
  protectedReturn,
  saveProtection,
  saveSeen,
  savedBy,
  type Protection,
} from './abuse';
import { useSession } from './session';
import { WalletContext, useWallet, type WalletValue } from './wallet';

/** How often to ask the server which events are on. The API is throttled, so this stays gentle. */
export const POLL_MS = 15_000;

/** What happened for this player with an event: they got coins, got protected, or had already taken it. */
export type EventOutcome = 'coins' | 'protected' | 'already';

export interface AbuseEventsValue {
  /** Events that are on right now, newest first. */
  events: AbuseEvent[];
  outcomes: Record<string, EventOutcome>;
  /** The player's next game cannot cost them any coins. */
  protectedNext: boolean;
  /** Set right after protection refunded a game: how many coins it saved. */
  lastSaved: number | null;
  dismissSaved: () => void;
  /** Asks the server again straight away, for example right after the admin starts an event. */
  refresh: () => Promise<void>;
}

// Without a provider (in tests, or before login) there are simply no events.
const IDLE: AbuseEventsValue = {
  events: [],
  outcomes: {},
  protectedNext: false,
  lastSaved: null,
  dismissSaved: () => {},
  refresh: async () => {},
};
const AbuseEventsContext = createContext<AbuseEventsValue>(IDLE);

export const useAbuseEvents = () => useContext(AbuseEventsContext);

/**
 * Keeps up with the admin's events: it polls for them, claims each one exactly once, and applies the effect.
 *  - FREE_COINS pays the coins into the wallet.
 *  - UNLOSEABLE protects the next game: whatever the game pays back, the player gets at least their stake.
 * It also hands the games a wallet that applies that protection, so no game needs to know about events.
 */
export function AbuseEventsProvider({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const base = useWallet();
  const userId = session.user.userId;

  // Latest values for the callbacks below, which must not change identity (they sit in effects and timers).
  const baseRef = useRef(base);
  baseRef.current = base;
  const tokenRef = useRef(session.idToken);
  tokenRef.current = session.idToken;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const [events, setEvents] = useState<AbuseEvent[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, EventOutcome>>({});
  const [protection, setProtection] = useState<Protection | null>(() => loadProtection(userId));
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Protection is read and cleared from inside wallet calls, so it lives in a ref as well as in state.
  const protectionRef = useRef(protection);
  protectionRef.current = protection;
  /** Coins wagered since protection began, until the game ends and settles. */
  const stakeRef = useRef(0);
  /** Events already handled, so each is claimed at most once from this browser. */
  const seenRef = useRef(new Set(loadSeen(userId)));
  const inFlightRef = useRef(new Set<string>());

  const markSeen = useCallback(
    (eventId: string) => {
      seenRef.current.add(eventId);
      saveSeen(userId, [...seenRef.current]);
    },
    [userId],
  );

  const handle = useCallback(
    async (event: AbuseEvent) => {
      const id = event.eventId;
      if (seenRef.current.has(id) || inFlightRef.current.has(id)) return;
      inFlightRef.current.add(id);
      try {
        // The server says yes to only one claim per player and event, so two tabs can't both take the effect.
        const { claimed } = await claimEvent(tokenRef.current, id);
        markSeen(id);
        if (!claimed) {
          setOutcomes((o) => ({ ...o, [id]: 'already' }));
        } else if (event.type === 'FREE_COINS') {
          baseRef.current.settle(event.amount ?? 0);
          setOutcomes((o) => ({ ...o, [id]: 'coins' }));
        } else {
          const next = { eventId: id };
          protectionRef.current = next;
          setProtection(next);
          saveProtection(userId, next);
          setOutcomes((o) => ({ ...o, [id]: 'protected' }));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) logoutRef.current();
        // An event that has ended or vanished is gone for good. Anything else (a dropped connection) is retried next time.
        else if (err instanceof ApiError && (err.status === 404 || err.status === 410)) markSeen(id);
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [markSeen, userId],
  );

  const refresh = useCallback(async () => {
    try {
      const list = (await listActiveEvents(tokenRef.current)).events;
      setEvents(list);
      for (const event of list) if (isLive(event)) await handle(event);
    } catch (err) {
      // A rejected login means logging in again. Anything else is quiet: announcements are a bonus, not a blocker.
      if (err instanceof ApiError && err.status === 401) logoutRef.current();
    }
  }, [handle]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  /** The wallet the games see: the real one, plus protection for the first game that ends after it is claimed. */
  const wallet = useMemo<WalletValue>(
    () => ({
      ...base,
      wager: (amount) => {
        const ok = base.wager(amount);
        if (ok && protectionRef.current) stakeRef.current += amount;
        return ok;
      },
      settle: (returned) => {
        const staked = stakeRef.current;
        if (!protectionRef.current || staked <= 0) return base.settle(returned);

        // The protected game just ended: pay back at least the stake, and the protection is used up.
        stakeRef.current = 0;
        protectionRef.current = null;
        setProtection(null);
        clearProtection(userId);
        const saved = savedBy(staked, returned);
        setLastSaved(saved > 0 ? saved : null);
        base.settle(protectedReturn(staked, returned));
      },
    }),
    [base, userId],
  );

  const value = useMemo<AbuseEventsValue>(
    () => ({
      events,
      outcomes,
      protectedNext: protection !== null,
      lastSaved,
      dismissSaved: () => setLastSaved(null),
      refresh,
    }),
    [events, outcomes, protection, lastSaved, refresh],
  );

  return (
    <AbuseEventsContext.Provider value={value}>
      <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
    </AbuseEventsContext.Provider>
  );
}
