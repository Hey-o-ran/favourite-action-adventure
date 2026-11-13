import { createContext, useContext } from 'react';

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface Session {
  idToken: string;
  /** Epoch milliseconds when the token stops being accepted. */
  expiresAt: number;
  user: SessionUser;
}

const KEY = 'card-casino.session';

/** Per-tab storage: closing the tab logs the player out. */
export function saveSession(session: Session): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session still lasts for this page load.
  }
}

export function clearSession(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

function isSession(value: unknown): value is Session {
  const s = value as Session | null;
  return (
    !!s &&
    typeof s.idToken === 'string' &&
    typeof s.expiresAt === 'number' &&
    !!s.user &&
    typeof s.user.email === 'string' &&
    typeof s.user.displayName === 'string' &&
    typeof s.user.isAdmin === 'boolean'
  );
}

export function loadSession(now: number = Date.now()): Session | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;
    if (parsed.expiresAt <= now) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface SessionContextValue {
  session: Session;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <AuthGate>');
  return value;
}
