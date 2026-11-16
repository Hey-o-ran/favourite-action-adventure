import { useState, type FormEvent } from 'react';
import { ApiError, getPlayerLog, searchLogAccounts, type LogAccount, type LogEntry, type LogType } from '../api';
import { useI18n, type MessageKey, type Translate } from '../i18n';
import { useSession } from '../session';

const CHIPS: { type: LogType | undefined; label: MessageKey }[] = [
  { type: undefined, label: 'log.chipAll' },
  { type: 'balance', label: 'log.chipBalance' },
  { type: 'login', label: 'log.chipLogin' },
  { type: 'adminCoins', label: 'log.chipAdminCoins' },
  { type: 'win', label: 'log.chipWin' },
  { type: 'account', label: 'log.chipAccount' },
  { type: 'event', label: 'log.chipEvent' },
];

const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** The words for one entry. Only what the server logged is shown: never an email, a device or an address. */
function describe(entry: LogEntry, t: Translate): { line: string; note?: string; warn?: boolean } {
  const d = entry.details;
  switch (entry.type) {
    case 'balance':
      return { line: t('log.balance', { before: num(d.before), after: num(d.after), delta: signed(num(d.delta)) }) };
    case 'login':
      if (d.ok === true) return { line: t('log.loginOk') };
      return { line: t(d.reason === 'pending' ? 'log.loginPending' : d.reason === 'unconfirmed' ? 'log.loginUnconfirmed' : 'log.loginBad') };
    case 'adminCoins':
      return { line: t('log.adminCoins', { amount: signed(num(d.amount)), by: text(d.by), balance: num(d.balanceAfter) }) };
    case 'account':
      if (d.step === 'approved') return { line: t('log.approved', { by: text(d.by) }) };
      return { line: t(d.step === 'confirmed' ? 'log.confirmed' : 'log.registered') };
    case 'event':
      return { line: t('log.event', { type: text(d.eventType) }) };
    case 'win': {
      const win = t(`log.winName.${text(d.win)}` as MessageKey);
      const line =
        d.bet === undefined
          ? t('log.win', { win, prize: num(d.prize) })
          : t('log.winBet', { win, prize: num(d.prize), bet: num(d.bet) });
      if (d.confirmed !== true) return { line, note: t('log.unconfirmed'), warn: true };
      return { line, note: d.announced === true ? t('log.announced') : t('log.notAnnounced') };
    }
  }
}

/** UTC, to the minute, so the admin and the server agree on when things happened. */
const when = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

/** Admins only: find any account, in any state, and read what it has done in the last 90 days. */
export function AdminLog() {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [accounts, setAccounts] = useState<LogAccount[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  const [chosen, setChosen] = useState<LogAccount>();
  const [kind, setKind] = useState<LogType | undefined>();
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [next, setNext] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const failed = (err: unknown, message: MessageKey, show: (m: string) => void) => {
    if (err instanceof ApiError && err.status === 401) logout();
    else show(t(message));
  };

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearchError(undefined);
    if (term.trim().length < 2) {
      setSearchError(t('coins.tooShort'));
      return;
    }
    try {
      const res = await searchLogAccounts(session.idToken, term.trim());
      setAccounts(res.users);
      setTruncated(res.truncated);
      setChosen(undefined);
      setEntries(null);
    } catch (err) {
      failed(err, 'coins.searchError', setSearchError);
    }
  }

  async function load(account: LogAccount, type: LogType | undefined, before?: string) {
    setError(undefined);
    setLoading(true);
    try {
      const options: { type?: LogType; before?: string } = {};
      if (type) options.type = type;
      if (before) options.before = before;
      const res = await getPlayerLog(session.idToken, account.userId, options);
      setEntries((current) => (before ? [...(current ?? []), ...res.entries] : res.entries));
      setNext(res.next);
    } catch (err) {
      failed(err, 'log.loadError', setError);
    } finally {
      setLoading(false);
    }
  }

  function open(account: LogAccount) {
    setChosen(account);
    setKind(undefined);
    setEntries(null);
    setNext(undefined);
    void load(account, undefined);
  }

  function choose(type: LogType | undefined) {
    if (!chosen) return;
    setKind(type);
    setEntries(null);
    setNext(undefined);
    void load(chosen, type);
  }

  return (
    <section className="admin-coins admin-log" aria-labelledby="admin-log-title">
      <h3 id="admin-log-title">{t('log.title')}</h3>
      <p className="hint">{t('log.hint')}</p>

      <form className="coins-search" onSubmit={search}>
        <label>
          {t('log.find')}
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('coins.placeholder')} />
        </label>
        <button type="submit">{t('log.search')}</button>
      </form>

      {searchError && (
        <p role="alert" className="login-error">
          {searchError}
        </p>
      )}
      {accounts?.length === 0 && <p className="hint">{t('log.nobody')}</p>}

      {accounts && accounts.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('register.displayName')}</th>
              <th>{t('login.email')}</th>
              <th>{t('log.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.userId} className={a.userId === chosen?.userId ? 'chosen' : undefined}>
                <td>{a.displayName}</td>
                <td>{a.email}</td>
                <td>{a.status}</td>
                <td>
                  <button onClick={() => open(a)} aria-label={t('log.showFor', { name: a.displayName })}>
                    {t('log.show')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {truncated && <p className="hint">{t('coins.more')}</p>}

      {chosen && (
        <div className="log-view">
          <h4>{t('log.of', { name: chosen.displayName })}</h4>
          <div className="log-chips" role="group" aria-label={t('log.kinds')}>
            {CHIPS.map((chip) => (
              <button key={chip.label} aria-pressed={kind === chip.type} onClick={() => choose(chip.type)}>
                {t(chip.label)}
              </button>
            ))}
          </div>

          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          {entries?.length === 0 && <p className="hint">{t('log.empty')}</p>}
          {entries && entries.length > 0 && (
            <ul className="log-entries" aria-label={t('log.entries')}>
              {entries.map((entry) => {
                const { line, note, warn } = describe(entry, t);
                return (
                  <li key={entry.logId} className={warn ? 'log-unconfirmed' : undefined}>
                    <time dateTime={entry.createdAt}>{when(entry.createdAt)}</time> <span>{line}</span>
                    {note && <strong className="log-note"> {note}</strong>}
                  </li>
                );
              })}
            </ul>
          )}
          {next && (
            <button disabled={loading} onClick={() => load(chosen, kind, next)}>
              {t('log.showMore')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
