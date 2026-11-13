import { useState } from 'react';
import { ApiError, startEvent, type AbuseEventType } from '../api';
import { useAbuseEvents } from '../abuseEvents';
import { useSession } from '../session';

/** How long an event can last. Players must be online to take part, so these are short. */
const DURATIONS = [5, 10, 30, 60];
const DEFAULT_COINS = 1000;
const MAX_COINS = 100_000;

const TYPES: { id: AbuseEventType; label: string; hint: string }[] = [
  { id: 'FREE_COINS', label: 'Free coins', hint: 'Every player online gets coins added to their balance.' },
  { id: 'UNLOSEABLE', label: 'Unloseable game', hint: "Every player's next game can't cost them any coins." },
];

const endTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Admins only: start an "admin abuse" event. Every player sees an announcement and the effect applies to them. */
export function AdminAbuse() {
  const { session, logout } = useSession();
  const { events, refresh } = useAbuseEvents();
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
      ? `Enter a whole number of coins from 1 to ${MAX_COINS.toLocaleString('en-US')}.`
      : undefined;
  const announcement =
    type === 'FREE_COINS'
      ? `Everyone gets ${amountError ? '…' : coins.toLocaleString('en-US')} coins!`
      : "Everybody's next game is unloseable!";

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
      setStarted(`Started for ${minutes} minutes: ${event.title}: ${event.message}`);
      setConfirming(false);
      await refresh(); // the admin is a player too, so they get the announcement straight away
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.status === 403) setError('Only admins can start events.');
      else if (err instanceof ApiError && err.fields && Object.values(err.fields)[0]) setError(Object.values(err.fields)[0]);
      else setError('Could not start the event. Please try again.');
      setConfirming(false);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section className="admin-abuse" aria-labelledby="admin-abuse-title">
      <h3 id="admin-abuse-title">Admin abuse</h3>
      <p className="hint">Start an event for every player. They see an announcement at the top of their screen straight away.</p>

      <fieldset className="abuse-form">
        <legend>Event</legend>
        {TYPES.map((t) => (
          <label key={t.id} className="abuse-choice">
            <input
              type="radio"
              name="abuse-type"
              checked={type === t.id}
              onChange={() => {
                setType(t.id);
                setConfirming(false);
              }}
            />
            <span>
              <b>{t.label}</b> <span className="hint">{t.hint}</span>
            </span>
          </label>
        ))}

        {type === 'FREE_COINS' && (
          <label className="abuse-field">
            <span>Coins for each player</span>
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
          <span>Lasts</span>
          <select
            value={minutes}
            onChange={(e) => {
              setMinutes(Number(e.target.value));
              setConfirming(false);
            }}
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <p className="abuse-preview">
        Players will see: <b>ADMIN ABUSE</b> {announcement}
      </p>

      {!confirming ? (
        <button className="primary" onClick={() => setConfirming(true)} disabled={Boolean(amountError) || starting}>
          Start event
        </button>
      ) : (
        <div className="abuse-confirm" role="group" aria-label="Confirm the event">
          <span>This tells every player now. It can't be undone.</span>
          <button className="primary" onClick={start} disabled={starting}>
            {starting ? 'Starting…' : 'Yes, start it'}
          </button>
          <button onClick={() => setConfirming(false)} disabled={starting}>
            Cancel
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

      <h4>On now</h4>
      {events.length === 0 ? (
        <p className="hint">No events are on.</p>
      ) : (
        <ul className="abuse-live">
          {events.map((e) => (
            <li key={e.eventId}>
              {e.message} <span className="hint">until {endTime(e.expiresAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
