import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, banUser, liftBan, listBans, type Ban, type FoundUser } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import { formatDuration } from '../statsFormat';

export const MAX_TITLE = 60;
export const MAX_DESCRIPTION = 500;
/** The longest ban the server allows: ten years. */
export const MAX_BAN_MINUTES = 5_256_000;

const UNITS = { minutes: 1, hours: 60, days: 1440 } as const;
type Unit = keyof typeof UNITS;

/** The form for banning the player chosen above: a title, a description, and how long. Asks once more before it bans. */
export function BanForm({ player, onBanned }: { player: FoundUser; onBanned: () => void }) {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('hours');
  /** The length, in minutes, waiting for the admin to confirm. */
  const [confirming, setConfirming] = useState<number | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const edited = () => {
    setConfirming(null);
    setError(undefined);
    setDone(undefined);
  };

  function check(e: FormEvent) {
    e.preventDefault();
    setDone(undefined);
    const n = Number(amount);
    const minutes = n * UNITS[unit];
    if (title.trim().length < 1 || title.trim().length > MAX_TITLE) return setError(t('ban.errTitle'));
    if (description.trim().length < 1 || description.trim().length > MAX_DESCRIPTION) return setError(t('ban.errDesc'));
    if (!/^\d+$/.test(amount.trim()) || n < 1 || minutes > MAX_BAN_MINUTES) return setError(t('ban.errLength'));
    setError(undefined);
    setConfirming(minutes);
  }

  async function ban(minutes: number) {
    setWorking(true);
    try {
      const res = await banUser(session.idToken, player.userId, { title: title.trim(), description: description.trim(), durationMinutes: minutes });
      setDone(t('ban.done', { name: player.displayName, date: new Date(res.ban.until).toLocaleString() }));
      setTitle('');
      setDescription('');
      setAmount('');
      setConfirming(null);
      onBanned();
    } catch (err) {
      setConfirming(null);
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.code === 'FORBIDDEN') setError(t('ban.errForbidden', { name: player.displayName }));
      else if (err instanceof ApiError && err.status === 404) setError(t('ban.errGone', { name: player.displayName }));
      else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') setError(t('ban.errLength'));
      else setError(t('ban.failed'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className="ban-form" onSubmit={check} noValidate>
      <h4>{t('ban.banning', { name: player.displayName })}</h4>
      <label>
        {t('ban.titleLabel')}
        <input
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => {
            setTitle(e.target.value);
            edited();
          }}
        />
        <small>{t('ban.titleHelp')}</small>
      </label>
      <label>
        {t('ban.descLabel')}
        <textarea
          value={description}
          rows={3}
          maxLength={MAX_DESCRIPTION}
          onChange={(e) => {
            setDescription(e.target.value);
            edited();
          }}
        />
        <small>{t('ban.descHelp')}</small>
      </label>
      <div className="ban-length">
        <label>
          {t('ban.lengthLabel')}
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              edited();
            }}
          />
        </label>
        <select
          aria-label={t('ban.lengthLabel')}
          value={unit}
          onChange={(e) => {
            setUnit(e.target.value as Unit);
            edited();
          }}
        >
          {(Object.keys(UNITS) as Unit[]).map((u) => (
            <option key={u} value={u}>
              {t(`ban.unit.${u}` as 'ban.unit.minutes')}
            </option>
          ))}
        </select>
      </div>

      {confirming === null ? (
        <button type="submit" className="primary" disabled={working}>
          {t('ban.submit', { name: player.displayName })}
        </button>
      ) : (
        <div className="ban-confirm" role="group" aria-label={t('ban.submit', { name: player.displayName })}>
          <p>{t('ban.confirm', { name: player.displayName, time: formatDuration(confirming * 60, t) })}</p>
          <button type="button" className="primary" disabled={working} onClick={() => ban(confirming)}>
            {t('ban.confirmYes')}
          </button>
          <button type="button" disabled={working} onClick={() => setConfirming(null)}>
            {t('ban.confirmNo')}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="login-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="hint">
          {done}
        </p>
      )}
    </form>
  );
}

/** The bans that are on now, each with a button to lift it. `refresh` changes when a ban was just made. */
export function BansList({ refresh }: { refresh: number }) {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [bans, setBans] = useState<Ban[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [lifting, setLifting] = useState<string>();
  const [message, setMessage] = useState<{ text: string; problem: boolean }>();

  const load = useCallback(() => {
    let cancelled = false;
    listBans(session.idToken)
      .then((res) => {
        if (cancelled) return;
        setBans(res.bans);
        setFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) logout();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.idToken, logout]);

  useEffect(() => load(), [load, refresh]);

  async function lift(ban: Ban) {
    setMessage(undefined);
    setLifting(ban.userId);
    try {
      await liftBan(session.idToken, ban.userId);
      setBans((list) => (list ?? []).filter((b) => b.userId !== ban.userId));
      setMessage({ text: t('ban.unbanned', { name: ban.displayName }), problem: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setMessage({ text: t('ban.unbanFailed'), problem: true });
    } finally {
      setLifting(undefined);
    }
  }

  return (
    <section className="ban-list" aria-labelledby="ban-list-title">
      <h4 id="ban-list-title">{t('ban.listTitle')}</h4>
      {failed && (
        <p role="alert" className="login-error">
          {t('ban.listError')}
        </p>
      )}
      {bans === null && !failed && <p className="hint">{t('common.loading')}</p>}
      {bans?.length === 0 && <p className="hint">{t('ban.listNone')}</p>}
      {bans && bans.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('register.displayName')}</th>
              <th>{t('ban.titleLabel')}</th>
              <th>{t('ban.lengthLabel')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bans.map((b) => (
              <tr key={b.userId}>
                <td>{b.displayName}</td>
                <td>{b.title}</td>
                <td>{t('ban.listEnds', { date: new Date(b.until).toLocaleString() })}</td>
                <td>
                  <button disabled={lifting !== undefined} aria-label={t('ban.unbanName', { name: b.displayName })} onClick={() => lift(b)}>
                    {t('ban.unban')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && (
        <p role={message.problem ? 'alert' : 'status'} className={message.problem ? 'login-error' : 'hint'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
