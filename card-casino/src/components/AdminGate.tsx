import { useState, type FormEvent } from 'react';
import { checkAdminPassword } from '../adminGate';

interface AdminGateProps {
  onUnlock: () => void;
  /** Leave without entering a password. */
  onCancel: () => void;
}

/** A full-screen page, like the login page, that asks for the admin password. Covers the casino without closing it. */
export function AdminGate({ onUnlock, onCancel }: AdminGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (await checkAdminPassword(password)) {
        onUnlock();
        return;
      }
      setError(true);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login admin-gate" role="dialog" aria-modal="true" aria-label="Admin access">
      <form className="login-card" onSubmit={submit} noValidate>
        <h1>Admin access</h1>
        <label>
          Password
          <input
            type="password"
            autoComplete="off"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
          />
        </label>
        {error && (
          <p role="alert" className="login-error">
            That password is not right.
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Enter'}
        </button>
        <button type="button" onClick={onCancel}>
          Back to game
        </button>
      </form>
    </div>
  );
}
