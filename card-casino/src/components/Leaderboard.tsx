import { useEffect, useState } from 'react';
import { ApiError, getLeaderboard, type LeaderboardResponse } from '../api';
import { useSession } from '../session';
import { useWallet } from '../wallet';

const coins = (n: number) => n.toLocaleString('en-US');

/** The 10 players with the most coins, and where you stand. */
export function Leaderboard() {
  const { session, logout } = useSession();
  const { flush } = useWallet();
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);
  /** Bumped by "Try again" and "Refresh" to load the board once more. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    // Save your latest balance first, so your own line is as up to date as the number at the top of the page.
    flush()
      .catch(() => undefined)
      .then(() => getLeaderboard(session.idToken))
      .then((res) => {
        if (!cancelled) setBoard(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) logout();
        else setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.idToken, attempt, flush, logout]);

  const me = board?.you;
  const youInTop = !!me && !!board?.entries.some((e) => e.displayName === me.displayName);

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">Leaderboard</h2>
      <p className="hint">The 10 players with the most coins.</p>

      {failed && (
        <div role="alert" className="login-error">
          Could not load the leaderboard. Please try again.{' '}
          <button onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      )}
      {!board && !failed && <p className="hint">Loading…</p>}

      {board && board.entries.length === 0 && <p className="hint">Nobody is on the board yet.</p>}

      {board && board.entries.length > 0 && (
        <table className="leaderboard-table">
          <caption className="visually-hidden">Players ranked by coins</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Player</th>
              <th scope="col" className="coins">
                Coins
              </th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((e) => {
              const mine = e.displayName === me?.displayName;
              return (
                <tr key={`${e.rank}-${e.displayName}`} className={[`rank-${e.rank}`, mine && 'me'].filter(Boolean).join(' ')}>
                  <td>{e.rank}</td>
                  <td>
                    {e.displayName}
                    {mine && <span className="you-tag"> (you)</span>}
                  </td>
                  <td className="coins">{coins(e.coins)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {me && !youInTop && (
        <p className="leaderboard-you">
          You're <b>#{me.rank}</b> with <b>{coins(me.coins)}</b> coins.
        </p>
      )}

      {board && (
        <p className="hint leaderboard-foot">
          {board.total} {board.total === 1 ? 'player' : 'players'} in all.{' '}
          <button onClick={() => setAttempt((n) => n + 1)}>Refresh</button>
        </p>
      )}
    </section>
  );
}
