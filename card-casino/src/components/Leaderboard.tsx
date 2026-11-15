import { useEffect, useState } from 'react';
import { ApiError, getLeaderboard, type LeaderboardResponse } from '../api';
import { useI18n, formatNumber } from '../i18n';
import { useSession } from '../session';
import { useWallet } from '../wallet';
import { VerifiedBadge } from './VerifiedBadge';

/** The 10 players with the most coins, and where you stand. */
export function Leaderboard() {
  const { session, logout } = useSession();
  const { flush } = useWallet();
  const { t, tx } = useI18n();
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
      <h2 id="leaderboard-title">{t('menu.leaderboard')}</h2>
      <p className="hint">{t('leaderboard.hint')}</p>

      {failed && (
        <div role="alert" className="login-error">
          {t('leaderboard.loadError')} <button onClick={() => setAttempt((n) => n + 1)}>{t('common.tryAgain')}</button>
        </div>
      )}
      {!board && !failed && <p className="hint">{t('common.loading')}</p>}

      {board && board.entries.length === 0 && <p className="hint">{t('leaderboard.empty')}</p>}

      {board && board.entries.length > 0 && (
        <table className="leaderboard-table">
          <caption className="visually-hidden">{t('leaderboard.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('leaderboard.rank')}</th>
              <th scope="col">{t('leaderboard.player')}</th>
              <th scope="col" className="coins">
                {t('leaderboard.coins')}
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
                    {e.verified && <VerifiedBadge />}
                    {mine && <span className="you-tag"> {t('leaderboard.you')}</span>}
                  </td>
                  <td className="coins">{formatNumber(e.coins)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {me && !youInTop && (
        <p className="leaderboard-you">
          {tx('leaderboard.youAre', { rank: <b>{me.rank}</b>, coins: <b>{formatNumber(me.coins)}</b> })}
        </p>
      )}

      {board && (
        <p className="hint leaderboard-foot">
          {t(board.total === 1 ? 'leaderboard.totalOne' : 'leaderboard.totalMany', { count: board.total })}{' '}
          <button onClick={() => setAttempt((n) => n + 1)}>{t('leaderboard.refresh')}</button>
        </p>
      )}
    </section>
  );
}
