import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a game's action buttons stay switched off after a hand is dealt. They appear right where the
 * Deal button was, so the second click of a double-click on Deal would otherwise land on one of them
 * before the player has even seen their cards. This is longer than a double-click gap.
 */
export const DEAL_LOCK_MS = 600;

/** `locked` is true for DEAL_LOCK_MS after `lock()` is called. */
export function useDealLock() {
  const [locked, setLocked] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lock = useCallback(() => {
    setLocked(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLocked(false), DEAL_LOCK_MS);
  }, []);

  return { locked, lock };
}
