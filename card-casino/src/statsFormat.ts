import type { Translate } from './i18n';

export const gamesPlayed = (s: { wins: number; draws: number; losses: number }) => s.wins + s.draws + s.losses;

/** The share of games won, as a whole percentage, or null when no games were played. */
export function winRate(s: { wins: number; draws: number; losses: number }): number | null {
  const played = gamesPlayed(s);
  return played === 0 ? null : Math.round((s.wins / played) * 100);
}

/** Seconds as "2d 3h", "2h 5m", "14m" or "40s": the two biggest units that matter. */
export function formatDuration(seconds: number, t: Translate): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return hours > 0 ? `${t('time.days', { n: days })} ${t('time.hours', { n: hours })}` : t('time.days', { n: days });
  if (hours > 0) return minutes > 0 ? `${t('time.hours', { n: hours })} ${t('time.minutes', { n: minutes })}` : t('time.hours', { n: hours });
  if (minutes > 0) return t('time.minutes', { n: minutes });
  return t('time.seconds', { n: total % 60 });
}
