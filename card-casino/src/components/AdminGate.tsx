import { useState, type FormEvent } from 'react';
import { checkAdminPassword } from '../adminGate';
import { useI18n } from '../i18n';

interface AdminGateProps {
  onUnlock: () => void;
  /** Leave without entering a password. */
  onCancel: () => void;
}

/** A full-screen page, like the login page, that asks for the admin password. Covers the casino without closing it. */
export function AdminGate({ onUnlock, onCancel }: AdminGateProps) {
  const { t } = useI18n();
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
    <div className="login admin-gate" role="dialog" aria-modal="true" aria-label={t('adminGate.title')}>
      <form className="login-card" onSubmit={submit} noValidate>
        <h1>{t('adminGate.title')}</h1>
        <label>
          {t('login.password')}
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
            {t('adminGate.wrong')}
          </p>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? t('adminGate.checking') : t('adminGate.enter')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('menu.back')}
        </button>
      </form>
    </div>
  );
}
