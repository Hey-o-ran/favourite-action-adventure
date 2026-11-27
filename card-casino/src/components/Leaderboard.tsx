import { PlayerName } from './PlayerProfile';
import { Fragment, useEffect, useState } from 'react';
import { ApiError, getLeaderboard, type LeaderboardPeriod, type LeaderboardResponse, type PlayerStats } from '../api';
import { useI18n, formatNumber } from '../i18n';
import { useSession } from '../session';
import { formatDuration, gamesPlayed, winRate } from '../statsFormat';
import { useWallet } from '../wallet';
import { StatsDetail } from './StatsDetail';
import { VerifiedBadge } from './VerifiedBadge';

const PERIODS: LeaderboardPeriod[] = ['day', 'month', 'all'];
/** What an older server, which keeps no stats yet, shows for everyone. */
const NO_STATS: PlayerStats = { wins: 0, draws: 0, losses: 0, seconds: 0, games: [] };
const COLUMNS = 6;

/** The 10 players with the most coins, with their stats, and where you stand. */
export function Leaderboard() {
  const { session, logout } = useSession();
  const { flush } = useWallet();
  const { t, tx } = useI18n();
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  /** The players whose stats are opened. */
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  /** Bumped by "Try again" and "Refresh" to load the board once more. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    // Save your latest balance first, so your own line is as up to date as the number at the top of the page.
    flush()
      .catch(() => undefined)
      .then(() => getLeaderboard(session.idToken, period))
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
  }, [session.idToken, period, attempt, flush, logout]);

  const toggle = (name: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const me = board?.you;
  const youInTop = !!me && !!board?.entries.some((e) => e.displayName === me.displayName);

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title">{t('menu.leaderboard')}</h2>
      <p className="hint">{t('leaderboard.hint')}</p>

      <div className="period-buttons" role="group" aria-label={t('leaderboard.period')}>
        {PERIODS.map((p) => (
          <button key={p} className={period === p ? 'primary' : undefined} aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {t(`leaderboard.period.${p}` as 'leaderboard.period.all')}
          </button>
        ))}
      </div>
      <p className="hint">{t('leaderboard.statsNote')}</p>

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
              <th scope="col" className="rate">
                {t('leaderboard.winRate')}
              </th>
              <th scope="col" className="time">
                {t('leaderboard.timePlayed')}
              </th>
              <th scope="col" className="toggle">
                <span className="visually-hidden">{t('leaderboard.allGames')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((e) => {
              const mine = e.displayName === me?.displayName;
              const stats = e.stats ?? NO_STATS;
              const rate = winRate(stats);
              const opened = open.has(e.displayName);
              return (
                <Fragment key={`${e.rank}-${e.displayName}`}>
                  <tr className={[`rank-${e.rank}`, mine && 'me'].filter(Boolean).join(' ')}>
                    <td>{e.rank}</td>
                    <td>
                      <PlayerName profileId={e.profileId} userId={mine ? session.user.userId : undefined} name={e.displayName} />
                      {e.verified && <VerifiedBadge />}
                      {mine && <span className="you-tag"> {t('leaderboard.you')}</span>}
                    </td>
                    <td className="coins">{formatNumber(e.coins)}</td>
                    <td className="rate">{rate === null ? '–' : `${rate}%`}</td>
                    <td className="time">{stats.seconds > 0 ? formatDuration(stats.seconds, t) : '–'}</td>
                    <td className="toggle">
                      <button
                        className="stats-toggle"
                        aria-expanded={opened}
                        aria-label={t(opened ? 'leaderboard.hideStats' : 'leaderboard.showStats', { name: e.displayName })}
                        onClick={() => toggle(e.displayName)}
                      >
                        {opened ? '▴' : '▾'}
                      </button>
                    </td>
                  </tr>
                  {opened && (
                    <tr className="stats-detail">
                      <td colSpan={COLUMNS}>
                        <StatsDetail stats={stats} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {me && !youInTop && (
        <>
          <p className="leaderboard-you">
            {tx('leaderboard.youAre', { rank: <b>{me.rank}</b>, coins: <b>{formatNumber(me.coins)}</b> })}
          </p>
          {me.stats && (
            <div className="leaderboard-you-stats">
              <h3>{t('leaderboard.yourStats')}</h3>
              <p className="hint">
                {t('leaderboard.winRate')}: {winRate(me.stats) === null ? '–' : `${winRate(me.stats)}%`} · {t('leaderboard.timePlayed')}:{' '}
                {gamesPlayed(me.stats) + me.stats.seconds > 0 ? formatDuration(me.stats.seconds, t) : '–'}
              </p>
              <StatsDetail stats={me.stats} />
            </div>
          )}
        </>
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
