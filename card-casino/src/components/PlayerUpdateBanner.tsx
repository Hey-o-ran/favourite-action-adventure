import { useEffect, useState } from 'react';
import { ApiError, dismissPlayerUpdate, getPlayerUpdate, type PlayerUpdate } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';

/** Shows an update only until the server confirms this player dismissed it. */
export function PlayerUpdateBanner() {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [update, setUpdate] = useState<PlayerUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUpdate(null);
    getPlayerUpdate(session.idToken).then((result) => {
      if (active) setUpdate(result.update);
    }).catch((err: unknown) => {
      if (active && err instanceof ApiError && err.status === 401) logout();
    });
    return () => { active = false; };
  }, [session.idToken, logout]);

  async function dismiss() {
    if (!update || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await dismissPlayerUpdate(session.idToken, update.version);
      setUpdate(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setFailed(true);
    } finally { setBusy(false); }
  }

  if (!update) return null;
  return (
    <div className="abuse-bar player-update" role="status">
      <strong className="abuse-title">{t('playerUpdate.title')}</strong>
      <span className="abuse-message">{update.message}{failed && <span role="alert"> {t('playerUpdate.error')}</span>}</span>
      <button className="abuse-dismiss" onClick={dismiss} disabled={busy} aria-label={t('playerUpdate.dismiss')}>×</button>
    </div>
  );
}