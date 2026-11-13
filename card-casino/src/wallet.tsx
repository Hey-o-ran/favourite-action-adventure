import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export const STARTING_BALANCE = 1000;
export const REFILL_AMOUNT = 500;
const STORAGE_KEY = 'card-casino.balance';

function readBalance(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) return n;
    }
  } catch {
    // Storage unavailable (private mode, blocked): fall back to the default.
  }
  return STARTING_BALANCE;
}

export interface WalletValue {
  balance: number;
  /** Deducts `amount` from the balance. Returns false (and changes nothing) if it cannot be afforded. */
  wager(amount: number): boolean;
  /** Credits coins returned from a settled wager. Pass 0 for a loss. */
  settle(returned: number): void;
  /** Gives the player a fresh stake when they are out of coins. */
  refill(): void;
}

/** Exported so a wrapper (like the admin abuse protection) can provide an adjusted wallet to the games. */
export const WalletContext = createContext<WalletValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(readBalance);
  // A ref mirrors the balance so back-to-back wagers in one event see the latest value.
  const current = useRef(balance);

  const commit = useCallback((next: number) => {
    current.current = next;
    setBalance(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Ignore: the balance still works for this session.
    }
  }, []);

  const value = useMemo<WalletValue>(
    () => ({
      balance,
      wager: (amount) => {
        if (!Number.isInteger(amount) || amount <= 0 || amount > current.current) return false;
        commit(current.current - amount);
        return true;
      },
      settle: (returned) => {
        commit(current.current + Math.max(0, Math.floor(returned)));
      },
      refill: () => {
        if (current.current === 0) commit(REFILL_AMOUNT);
      },
    }),
    [balance, commit],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside WalletProvider');
  return value;
}
