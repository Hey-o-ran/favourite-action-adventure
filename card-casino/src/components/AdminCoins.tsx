import { useState, type FormEvent } from 'react';
import { ApiError, giveCoins, searchUsers, type FoundUser } from '../api';
import { useSession } from '../session';

const MAX_AMOUNT = 10_000_000;
const fmt = (n: number) => n.toLocaleString('en-US');

/** Admins only: find a player by name or email, then give them coins or take some away. */
export function AdminCoins() {
  const { session, logout } = useSession();
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
      setSearchError('Type at least 2 characters of a name or email.');
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
      else setSearchError('Could not search for players. Please try again.');
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
      setError(`Enter a whole number of coins from 1 to ${fmt(MAX_AMOUNT)}.`);
      return;
    }
    setWorking(true);
    try {
      const res = await giveCoins(session.idToken, user.userId, direction * n);
      setResults((list) => (list ?? []).map((u) => (u.userId === user.userId ? { ...u, balance: res.balance } : u)));
      setDone(
        `${direction === 1 ? `Gave ${fmt(n)} coins to ${user.displayName}` : `Took ${fmt(n)} coins from ${user.displayName}`}. Their balance is now ${fmt(res.balance)} coins.`,
      );
      setAmount('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
      else if (err instanceof ApiError && err.code === 'BALANCE_OUT_OF_RANGE') {
        const current = typeof err.details?.balance === 'number' ? err.details.balance : user.balance;
        setResults((list) => (list ?? []).map((u) => (u.userId === user.userId ? { ...u, balance: current } : u)));
        setError(
          `That would take the balance below 0 or above ${fmt(MAX_AMOUNT)}. ${user.displayName} has ${fmt(current)} coins.`,
        );
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_ACTIVE') {
        setError(`${user.displayName}'s account is not active, so it cannot be given coins.`);
      } else if (err instanceof ApiError && err.status === 404) {
        setError(`${user.displayName} could not be found any more.`);
      } else {
        setError('Could not change the coins. Please try again.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="admin-coins" aria-labelledby="admin-coins-title">
      <h3 id="admin-coins-title">Give or take coins</h3>
      <p className="hint">Find an approved player by name or email, then add or remove coins.</p>

      <form className="coins-search" onSubmit={search}>
        <label>
          Find a player
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Name or email" />
        </label>
        <button type="submit" disabled={searching}>
          Search
        </button>
      </form>

      {searchError && (
        <p role="alert" className="login-error">
          {searchError}
        </p>
      )}
      {results?.length === 0 && <p className="hint">No players found.</p>}

      {results && results.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Display name</th>
              <th>Email</th>
              <th>Balance</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr key={u.userId} className={u.userId === chosenId ? 'chosen' : undefined}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{fmt(u.balance)} coins</td>
                <td>
                  <button onClick={() => choose(u)} aria-label={`Choose ${u.displayName}`} aria-pressed={u.userId === chosenId}>
                    Choose
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {truncated && <p className="hint">More players match. Type more of the name or email to narrow it down.</p>}

      {chosen && (
        <div className="coins-form">
          <h4>Giving coins to {chosen.displayName}</h4>
          <label>
            Amount
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 250"
            />
          </label>
          <div className="coins-actions">
            <button className="primary" disabled={working} onClick={() => change(chosen, 1)}>
              Give coins
            </button>
            <button disabled={working} onClick={() => change(chosen, -1)}>
              Take coins
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
