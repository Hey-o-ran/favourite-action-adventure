import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, login } from '../api';
import { clearSession, loadSession, saveSession, SessionContext, type Session } from '../session';
import { RegisterForm } from './RegisterForm';

function loginMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return 'Incorrect email or password.';
    case 'ACCOUNT_PENDING':
      return 'Your account is waiting for admin approval. You can log in once it is approved.';
    case 'EMAIL_NOT_CONFIRMED':
      return 'Confirm your email address first. Use Register to get a new confirmation code.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.';
    case 'NETWORK_ERROR':
      return 'Could not reach the server. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Shows the login (or registration) until the player has a valid session, then renders the casino. */
export function AuthGate({ children }: { children: ReactNode }) {
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
    if (!trimmed || !password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const res = await login({ email: trimmed, password });
      const next: Session = { idToken: res.idToken, expiresAt: Date.now() + res.expiresIn * 1000, user: res.user };
      saveSession(next);
      setPassword('');
      setSession(next);
    } catch (err) {
      setError(loginMessage(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <h1>Card Casino</h1>
        <label>
          Email
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
          Password
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
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <button type="button" onClick={() => setView('register')} disabled={busy}>
          Register
        </button>
      </form>
    </div>
  );
}
