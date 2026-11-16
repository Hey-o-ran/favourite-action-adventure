import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, listWinAnnouncements, type WinAnnouncement } from './api';
import { POLL_MS } from './abuseEvents';
import { useSession } from './session';

export const SEEN_KEY = 'card-casino.win-announcements.seen';
/** How many ids are remembered. Announcements only last two minutes, so a short list is plenty. */
const REMEMBER = 100;

export interface WinAnnouncementsValue {
  /** Wins to show now: not dismissed, and not shown before. Newest first. */
  wins: WinAnnouncement[];
  dismiss: (announcementId: string) => void;
}

// Without a provider (in tests, or before login) there is nothing to show.
const IDLE: WinAnnouncementsValue = { wins: [], dismiss: () => {} };
const WinAnnouncementsContext = createContext<WinAnnouncementsValue>(IDLE);

export const useWinAnnouncements = () => useContext(WinAnnouncementsContext);

function loadSeen(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-REMEMBER)));
  } catch {
    // Not remembered; the worst case is a banner shown again after a reload.
  }
}

/**
 * Shows everyone's big wins. It asks the server every 15 seconds (the same check the site already makes for admin events
 * and coin messages), and shows each win once: a win that has been shown is remembered, even after a reload.
 */
export function WinAnnouncementsProvider({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const tokenRef = useRef(session.idToken);
  tokenRef.current = session.idToken;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const [wins, setWins] = useState<WinAnnouncement[]>([]);
  const seenRef = useRef(new Set(loadSeen()));

  const poll = useCallback(async () => {
    try {
      const { announcements } = await listWinAnnouncements(tokenRef.current);
      const fresh = announcements.filter((a) => !seenRef.current.has(a.announcementId));
      if (fresh.length === 0) return;
      for (const a of fresh) seenRef.current.add(a.announcementId);
      saveSeen([...seenRef.current]);
      setWins((current) => [...fresh, ...current]);
    } catch (err) {
      // A rejected login means logging in again. Anything else is quiet: announcements are a bonus, not a blocker.
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

  const dismiss = useCallback((announcementId: string) => {
    setWins((current) => current.filter((w) => w.announcementId !== announcementId));
  }, []);

  const value = useMemo<WinAnnouncementsValue>(() => ({ wins, dismiss }), [wins, dismiss]);
  return <WinAnnouncementsContext.Provider value={value}>{children}</WinAnnouncementsContext.Provider>;
}
