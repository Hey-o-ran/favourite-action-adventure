import { describe, expect, it } from 'vitest';
import { translate } from './i18n';
import { formatDuration, gamesPlayed, winRate } from './statsFormat';

const en = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) => translate('en-GB', key, values);
const zh = (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) => translate('zh-CN', key, values);

describe('the win rate', () => {
  it('is the share of games won, as a whole percentage', () => {
    expect(winRate({ wins: 14, draws: 3, losses: 9 })).toBe(54);
    expect(winRate({ wins: 1, draws: 0, losses: 3 })).toBe(25);
    expect(winRate({ wins: 2, draws: 0, losses: 1 })).toBe(67);
  });

  it('counts a draw as a game that was not won', () => {
    expect(winRate({ wins: 1, draws: 1, losses: 0 })).toBe(50);
  });

  it('is 0 or 100 at the extremes, and nothing at all when no games were played', () => {
    expect(winRate({ wins: 0, draws: 0, losses: 5 })).toBe(0);
    expect(winRate({ wins: 5, draws: 0, losses: 0 })).toBe(100);
    expect(winRate({ wins: 0, draws: 0, losses: 0 })).toBeNull();
    expect(gamesPlayed({ wins: 2, draws: 3, losses: 4 })).toBe(9);
  });
});

describe('the time played', () => {
  it('shows seconds under a minute, minutes under an hour, and hours with minutes after that', () => {
    expect(formatDuration(0, en)).toBe('0s');
    expect(formatDuration(40, en)).toBe('40s');
    expect(formatDuration(59, en)).toBe('59s');
    expect(formatDuration(60, en)).toBe('1m');
    expect(formatDuration(3599, en)).toBe('59m');
    expect(formatDuration(3600, en)).toBe('1h');
    expect(formatDuration(7500, en)).toBe('2h 5m');
    expect(formatDuration(36_000 + 1800, en)).toBe('10h 30m');
  });

  it('drops the seconds once there are minutes, and ignores what is not a whole second', () => {
    expect(formatDuration(125, en)).toBe('2m');
    expect(formatDuration(59.9, en)).toBe('59s');
    expect(formatDuration(-5, en)).toBe('0s');
  });

  it('is written in Chinese when asked', () => {
    expect(formatDuration(7500, zh)).toBe('2 小时 5 分钟');
    expect(formatDuration(40, zh)).toBe('40 秒');
  });
});
