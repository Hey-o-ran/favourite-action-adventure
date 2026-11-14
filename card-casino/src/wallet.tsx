import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, getBalance, saveBalance } from './api';
import { BalanceSync, type SyncState } from './balanceSync';
import { useSession } from './session';
import { useI18n } from './i18n';

/** What a new account starts with. The server applies it; this is only shown in the rules text. */
export const STARTING_BALANCE = 1000;

/** The balance used to live here, shared by every account on the browser. It now lives on the server. */
const LEGACY_STORAGE_KEY = 'card-casino.balance';

export interface WalletValue {
  balance: number;
  /** Deducts `amount` from the balance. Returns false (and changes nothing) if it cannot be afforded. */
  wager(amount: number): boolean;
  /** Credits coins returned from a settled wager. Pass 0 for a loss. */
  settle(returned: number): void;
  /** Saves any change to the server right now. */
  flush(): Promise<void>;
  /** `failed` while the latest balance has not reached the server yet. */
  status: SyncState['status'];
  /** A short message to show the player, e.g. after the server corrected the balance. */
  notice?: string;
  dismissNotice(): void;
}

/** Exported so a wrapper (like the admin abuse protection) can provide an adjusted wallet to the games. */
export const WalletContext = createContext<WalletValue | null>(null);

const INITIAL: SyncState = { balance: 0, version: 0, loaded: false, status: 'saved' };

export function WalletProvider({ children, saveDelayMs }: { children: ReactNode; saveDelayMs?: number }) {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const token = session.idToken;
  const [state, setState] = useState<SyncState>(INITIAL);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const syncRef = useRef<BalanceSync>();

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage unavailable: nothing to clean up.
    }
  }, []);

  useEffect(() => {
    setLoadFailed(false);
    setState(INITIAL);
    const sync = new BalanceSync(
      {
        get: () => getBalance(token),
        save: (balance, version, options) => saveBalance(token, { balance, version }, options),
      },
      { onChange: setState, onUnauthorized: logout },
      saveDelayMs,
    );
    syncRef.current = sync;

    let cancelled = false;
    sync.load().catch((err) => {
      if (cancelled) return;
      if (err instanceof ApiError && err.status === 401) logout();
      else setLoadFailed(true);
    });

    // Don't lose the last change when the tab is closed or hidden.
    const flushNow = () => void sync.flush({ keepalive: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      sync.dispose();
    };
  }, [token, logout, saveDelayMs, attempt]);

  const wager = useCallback((amount: number) => {
    const sync = syncRef.current;
    if (!sync) return false;
    const balance = sync.state.balance;
    if (!Number.isInteger(amount) || amount <= 0 || amount > balance) return false;
    sync.set(balance - amount);
    return true;
  }, []);
  const settle = useCallback((returned: number) => {
    const sync = syncRef.current;
    if (sync) sync.set(sync.state.balance + Math.max(0, Math.floor(returned)));
  }, []);
  const flush = useCallback(() => syncRef.current?.flush() ?? Promise.resolve(), []);
  const dismissNotice = useCallback(() => syncRef.current?.clearNotice(), []);

  const value = useMemo<WalletValue>(
    () => ({
      balance: state.balance,
      wager,
      settle,
      flush,
      status: state.status,
      notice: state.notice,
      dismissNotice,
    }),
    [state.balance, state.status, state.notice, wager, settle, flush, dismissNotice],
  );

  if (!state.loaded) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>{t('header.title')}</h1>
          {loadFailed ? (
            <>
              <p role="alert" className="login-error">
                {t('wallet.loadError')}
              </p>
              <button className="primary" onClick={() => setAttempt((n) => n + 1)}>
                {t('wallet.tryAgain')}
              </button>
            </>
          ) : (
            <p className="hint">{t('wallet.loading')}</p>
          )}
        </div>
      </div>
    );
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const value = useContext(WalletContext);
  if (!value) throw new Error('useWallet must be used inside WalletProvider');
  return value;
}
