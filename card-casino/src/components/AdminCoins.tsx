import { useState, type FormEvent } from 'react';
import { ApiError, giveCoins, searchUsers, type FoundUser } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';

const MAX_AMOUNT = 10_000_000;

/** Admins only: find a player by name or email, then give them coins or take some away. */
export function AdminCoins() {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [searching, setSearching] = useState(false);

  const [chosenId, setChosenId] = useState<string>();
  const [amount, setAmount] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const chosen = results?.find((u) => u.userId === chosenId);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearchError(undefined);
    if (term.trim().length < 2) {
      setSearchError(t('coins.tooShort'));
      return;
    }
    setSearching(true);
    try {
      const res = await searchUsers(session.idToken, term.trim());
      setResults(res.users);
      setTruncated(res.truncated);
      setChosenId(undefined);
      setError(undefined);
      setDone(undefined);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else setSearchError(t('coins.searchError'));
    } finally {
      setSearching(false);
    }
  }

  function choose(user: FoundUser) {
    setChosenId(user.userId);
    setAmount('');
    setError(undefined);
    setDone(undefined);
  }

  async function change(user: FoundUser, direction: 1 | -1) {
    setError(undefined);
    setDone(undefined);
    const n = Number(amount);
    if (!/^\d+$/.test(amount.trim()) || !Number.isInteger(n) || n < 1 || n > MAX_AMOUNT) {
      setError(t('coins.amountError', { max: MAX_AMOUNT }));
      return;
    }
    setWorking(true);
    try {
      const res = await giveCoins(session.idToken, user.userId, direction * n);
      setResults((list) => (list ?? []).map((u) => (u.userId === user.userId ? { ...u, balance: res.balance } : u)));
      setDone(
        t(direction === 1 ? 'coins.gave' : 'coins.took', { amount: n, name: user.displayName, balance: res.balance }),
      );
      setAmount('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.code === 'BALANCE_OUT_OF_RANGE') {
        const current = typeof err.details?.balance === 'number' ? err.details.balance : user.balance;
        setResults((list) => (list ?? []).map((u) => (u.userId === user.userId ? { ...u, balance: current } : u)));
        setError(t('coins.outOfRange', { max: MAX_AMOUNT, name: user.displayName, balance: current }));
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_ACTIVE') {
        setError(t('coins.notActive', { name: user.displayName }));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t('coins.gone', { name: user.displayName }));
      } else {
        setError(t('coins.failed'));
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="admin-coins" aria-labelledby="admin-coins-title">
      <h3 id="admin-coins-title">{t('coins.title')}</h3>
      <p className="hint">{t('coins.hint')}</p>

      <form className="coins-search" onSubmit={search}>
        <label>
          {t('coins.find')}
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('coins.placeholder')} />
        </label>
        <button type="submit" disabled={searching}>
          {t('coins.search')}
        </button>
      </form>

      {searchError && (
        <p role="alert" className="login-error">
          {searchError}
        </p>
      )}
      {results?.length === 0 && <p className="hint">{t('coins.none')}</p>}

      {results && results.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('register.displayName')}</th>
              <th>{t('login.email')}</th>
              <th>{t('coins.balance')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr key={u.userId} className={u.userId === chosenId ? 'chosen' : undefined}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{t('coins.balanceOf', { amount: u.balance })}</td>
                <td>
                  <button
                    onClick={() => choose(u)}
                    aria-label={t('coins.chooseName', { name: u.displayName })}
                    aria-pressed={u.userId === chosenId}
                  >
                    {t('coins.choose')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {truncated && <p className="hint">{t('coins.more')}</p>}

      {chosen && (
        <div className="coins-form">
          <h4>{t('coins.givingTo', { name: chosen.displayName })}</h4>
          <label>
            {t('coins.amount')}
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('coins.amountPlaceholder')}
            />
          </label>
          <div className="coins-actions">
            <button className="primary" disabled={working} onClick={() => change(chosen, 1)}>
              {t('coins.give')}
            </button>
            <button disabled={working} onClick={() => change(chosen, -1)}>
              {t('coins.take')}
            </button>
          </div>
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
    </section>
  );
}
