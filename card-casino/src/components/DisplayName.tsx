import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, changeDisplayName, getDisplayName, type DisplayNameSettings } from '../api';
import { useI18n, type MessageKey } from '../i18n';
import { useSession } from '../session';
import { useWallet } from '../wallet';

const errors: Record<string, MessageKey> = {
  VALIDATION_ERROR: 'nameChange.invalid',
  DISPLAY_NAME_TAKEN: 'nameChange.taken',
  SAME_DISPLAY_NAME: 'nameChange.same',
  NOT_ENOUGH_COINS: 'nameChange.notEnough',
  NAME_CHANGE_TOO_SOON: 'nameChange.tooSoon',
  NETWORK_ERROR: 'error.network',
};

export function DisplayName() {
  const { t, lang } = useI18n();
  const { session, logout, updateDisplayName } = useSession();
  const { applyExternalChange } = useWallet();
  const [settings, setSettings] = useState<DisplayNameSettings>();
  const [name, setName] = useState('');
  const [error, setError] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    getDisplayName(session.idToken).then((result) => {
      if (!active) return;
      setSettings(result);
      setName(result.displayName);
    }).catch((err: unknown) => {
      if (!active) return;
      if (err instanceof ApiError && err.status === 401) logout();
      else setError(err instanceof ApiError ? errors[err.code] ?? 'error.generic' : 'error.generic');
    });
    return () => { active = false; };
  }, [session.idToken, logout]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!settings || busy) return;
    if (!confirming) { setError(undefined); setSaved(false); setConfirming(true); return; }
    if (!applyExternalChange || !updateDisplayName) { setError('error.generic'); return; }
    setBusy(true);
    try {
      const result = await applyExternalChange(() => changeDisplayName(session.idToken, name.trim()));
      updateDisplayName(result.displayName);
      setSettings(result);
      setName(result.displayName);
      setConfirming(false);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setError(err instanceof ApiError ? errors[err.code] ?? 'error.generic' : 'error.generic');
      setConfirming(false);
    } finally { setBusy(false); }
  }

  return (
    <section className="login-card display-name-card" aria-labelledby="display-name-title">
      <h2 id="display-name-title">{t('nameChange.title')}</h2>
      {!settings && !error && <p>{t('nameChange.loading')}</p>}
      {settings && <form onSubmit={submit}>
        <p>{t('nameChange.cost', { cost: settings.cost })}</p>
        {settings.nextChangeAt && <p>{t('nameChange.next', { date: new Date(settings.nextChangeAt).toLocaleString(lang) })}</p>}
        <label>{t('nameChange.label')}
          <input value={name} maxLength={20} onChange={(event) => { setName(event.target.value); setConfirming(false); setSaved(false); setError(undefined); }} disabled={busy} />
        </label>
        <p className="hint">{t('nameChange.hint')}</p>
        {confirming && <p>{t('nameChange.confirm', { cost: settings.cost, name: name.trim() })}</p>}
        <button type="submit" className="primary" disabled={busy}>{t(busy ? 'nameChange.saving' : confirming ? 'nameChange.confirmButton' : 'nameChange.submit')}</button>
        {confirming && <button type="button" disabled={busy} onClick={() => setConfirming(false)}>{t('nameChange.cancel')}</button>}
      </form>}
      {error && <p role="alert" className="login-error">{t(error)}</p>}
      {saved && <p role="status">{t('nameChange.saved')}</p>}
    </section>
  );
}