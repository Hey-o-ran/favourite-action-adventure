import type { GameStats, PlayerStats } from '../api';
import { gameText, useI18n } from '../i18n';
import { formatDuration, winRate } from '../statsFormat';

type Record3 = { wins: number; draws: number; losses: number };

/** A bar split in three by wins (green), draws (grey) and losses (red). It reads out its numbers for a screen reader. */
export function ResultBar({ wins, draws, losses }: Record3) {
  const { t } = useI18n();
  const total = wins + draws + losses;
  const share = (n: number) => `${total === 0 ? 0 : (n / total) * 100}%`;
  return (
    <div className="result-bar" role="img" aria-label={t('leaderboard.barLabel', { wins, draws, losses })}>
      <span className="bar-win" style={{ width: share(wins) }} />
      <span className="bar-draw" style={{ width: share(draws) }} />
      <span className="bar-loss" style={{ width: share(losses) }} />
    </div>
  );
}

/** "14W 3D 9L" with each number in its colour. The letters mean the colours don't have to be told apart by sight. */
export function Record({ wins, draws, losses }: Record3) {
  const { t } = useI18n();
  return (
    <span className="record" aria-label={t('leaderboard.record', { wins, draws, losses })}>
      <span aria-hidden="true">
        <span className="w">
          {wins}
          {t('leaderboard.short.win')}
        </span>{' '}
        <span className="d">
          {draws}
          {t('leaderboard.short.draw')}
        </span>{' '}
        <span className="l">
          {losses}
          {t('leaderboard.short.loss')}
        </span>
      </span>
    </span>
  );
}

function Line({ name, stats }: { name: string; stats: Record3 & { seconds: number } }) {
  const { t } = useI18n();
  const rate = winRate(stats);
  return (
    <li className="stat-game">
      <span className="name">{name}</span>
      <ResultBar {...stats} />
      <Record {...stats} />
      <span className="rate">{rate === null ? '–' : `${rate}%`}</span>
      <span className="time">{formatDuration(stats.seconds, t)}</span>
    </li>
  );
}

/** Every game a player has played in the chosen time: a coloured bar, the numbers, win rate and time played. */
export function StatsDetail({ stats }: { stats: PlayerStats }) {
  const { t } = useI18n();
  if (stats.games.length === 0) return <p className="hint">{t('leaderboard.noGames')}</p>;
  return (
    <>
      <ul className="stat-list">
        <Line name={t('leaderboard.allGames')} stats={stats} />
        {stats.games.map((g: GameStats) => (
          <Line key={g.game} name={gameText(t, g.game, 'name', g.game)} stats={g} />
        ))}
      </ul>
      <ul className="stat-legend" aria-hidden="true">
        <li className="win">{t('leaderboard.legend.win')}</li>
        <li className="draw">{t('leaderboard.legend.draw')}</li>
        <li className="loss">{t('leaderboard.legend.loss')}</li>
      </ul>
    </>
  );
}
