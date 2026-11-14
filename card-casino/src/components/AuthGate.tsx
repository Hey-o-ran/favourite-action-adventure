import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, login } from '../api';
import { clearSession, loadSession, saveSession, SessionContext, type Session } from '../session';
import { RegisterForm } from './RegisterForm';
import { useI18n, type Translate } from '../i18n';

function loginMessage(err: unknown, t: Translate): string {
  if (!(err instanceof ApiError)) return t('error.generic');
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return t('login.invalid');
    case 'ACCOUNT_PENDING':
      return t('login.pending');
    case 'EMAIL_NOT_CONFIRMED':
      return t('login.notConfirmed');
    case 'RATE_LIMITED':
      return t('error.rateLimited');
    case 'NETWORK_ERROR':
      return t('error.network');
    default:
      return t('error.generic');
  }
}

/** Shows the login (or registration) until the player has a valid session, then renders the casino. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [view, setView] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setView('login');
    setPassword('');
  }, []);

  // When the token runs out, send the player back to the login.
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    const timer = window.setTimeout(logout, Math.max(0, Math.min(ms, 2_147_483_647)));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo(() => (session ? { session, logout } : null), [session, logout]);

  if (value) return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
  if (view === 'register') return <RegisterForm onBack={() => setView('login')} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return setError(t('login.enterBoth'));
    setBusy(true);
    try {
      const res = await login({ email: trimmed, password });
      const next: Session = { idToken: res.idToken, expiresAt: Date.now() + res.expiresIn * 1000, user: res.user };
      saveSession(next);
      setPassword('');
      setSession(next);
    } catch (err) {
      setError(loginMessage(err, t));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <h1>{t('header.title')}</h1>
        <label>
          {t('login.email')}
          <input
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(undefined);
            }}
          />
        </label>
        <label>
          {t('login.password')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? t('login.busy') : t('login.submit')}
        </button>
        <button type="button" onClick={() => setView('register')} disabled={busy}>
          {t('login.register')}
        </button>
      </form>
    </div>
  );
}
