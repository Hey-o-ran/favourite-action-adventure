import { useState } from 'react';
import { ApiError, startEvent, type AbuseEventType } from '../api';
import { useAbuseEvents } from '../abuseEvents';
import { eventWords } from '../abuseText';
import { useI18n, type MessageKey } from '../i18n';
import { useSession } from '../session';

/** How long an event can last. Players must be online to take part, so these are short. */
const DURATIONS = [5, 10, 30, 60];
const DEFAULT_COINS = 1000;
const MAX_COINS = 100_000;

const TYPES: { id: AbuseEventType; label: MessageKey; hint: MessageKey }[] = [
  { id: 'FREE_COINS', label: 'abuse.freeCoins', hint: 'abuse.freeCoinsHint' },
  { id: 'UNLOSEABLE', label: 'abuse.unloseable', hint: 'abuse.unloseableHint' },
];

const endTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Admins only: start an "admin abuse" event. Every player sees an announcement and the effect applies to them. */
export function AdminAbuse() {
  const { session, logout } = useSession();
  const { events, refresh } = useAbuseEvents();
  const { t, tx, lang } = useI18n();
  const [type, setType] = useState<AbuseEventType>('FREE_COINS');
  const [amount, setAmount] = useState(String(DEFAULT_COINS));
  const [minutes, setMinutes] = useState(10);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const [started, setStarted] = useState<string>();

  const coins = Number(amount);
  const amountError =
    type === 'FREE_COINS' && !(Number.isInteger(coins) && coins >= 1 && coins <= MAX_COINS)
      ? t('abuse.amountError', { max: MAX_COINS })
      : undefined;
  // What players will see, worded the same way the announcement itself is.
  const announcement =
    type === 'FREE_COINS'
      ? t('announce.freeCoins', { amount: amountError ? '…' : coins })
      : t('announce.unloseable');

  async function start() {
    setError(undefined);
    setStarted(undefined);
    setStarting(true);
    try {
      const { event } = await startEvent(session.idToken, {
        type,
        ...(type === 'FREE_COINS' && { amount: coins }),
        durationMinutes: minutes,
      });
      const words = eventWords(event, lang, t);
      setStarted(t('abuse.started', { minutes, title: words.title, message: words.message }));
      setConfirming(false);
      await refresh(); // the admin is a player too, so they get the announcement straight away
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.status === 403) setError(t('abuse.onlyAdmins'));
      else if (lang === 'en-GB' && err instanceof ApiError && err.fields && Object.values(err.fields)[0]) {
        // The server's own wording is English, so it is only passed on as it is in English.
        setError(Object.values(err.fields)[0]);
      } else setError(t('abuse.startFailed'));
      setConfirming(false);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="admin-abuse" aria-labelledby="admin-abuse-title">
      <h3 id="admin-abuse-title">{t('abuse.title')}</h3>
      <p className="hint">{t('abuse.hint')}</p>

      <fieldset className="abuse-form">
        <legend>{t('abuse.event')}</legend>
        {TYPES.map((option) => (
          <label key={option.id} className="abuse-choice">
            <input
              type="radio"
              name="abuse-type"
              checked={type === option.id}
              onChange={() => {
                setType(option.id);
                setConfirming(false);
              }}
            />
            <span>
              <b>{t(option.label)}</b> <span className="hint">{t(option.hint)}</span>
            </span>
          </label>
        ))}

        {type === 'FREE_COINS' && (
          <label className="abuse-field">
            <span>{t('abuse.coinsEach')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COINS}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirming(false);
              }}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? 'abuse-amount-error' : undefined}
            />
          </label>
        )}
        {amountError && (
          <p id="abuse-amount-error" role="alert" className="login-error">
            {amountError}
          </p>
        )}

        <label className="abuse-field">
          <span>{t('abuse.lasts')}</span>
          <select
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setConfirming(false);
            }}
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {t('abuse.minutes', { count: m })}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <p className="abuse-preview">
        {tx('abuse.preview', {
          message: (
            <>
              <b>{t('announce.eventTitle')}</b> {announcement}
            </>
          ),
        })}
      </p>

      {!confirming ? (
        <button className="primary" onClick={() => setConfirming(true)} disabled={Boolean(amountError) || starting}>
          {t('abuse.start')}
        </button>
      ) : (
        <div className="abuse-confirm" role="group" aria-label={t('abuse.confirmGroup')}>
          <span>{t('abuse.confirmText')}</span>
          <button className="primary" onClick={start} disabled={starting}>
            {starting ? t('abuse.starting') : t('abuse.yesStart')}
          </button>
          <button onClick={() => setConfirming(false)} disabled={starting}>
            {t('abuse.cancel')}
          </button>
        </div>
      )}

      {started && (
        <p role="status" className="hint abuse-started">
          {started}
        </p>
      )}
      {error && (
        <p role="alert" className="login-error">
          {error}
        </p>
      )}

      <h4>{t('abuse.onNow')}</h4>
      {events.length === 0 ? (
        <p className="hint">{t('abuse.noneOn')}</p>
      ) : (
        <ul className="abuse-live">
          {events.map((e) => (
            <li key={e.eventId}>
              {eventWords(e, lang, t).message} <span className="hint">{t('abuse.until', { time: endTime(e.expiresAt) })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
