// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Leaderboard } from './Leaderboard';
import { SessionContext, type Session } from '../session';
import { WalletContext, type WalletValue } from '../wallet';
import * as api from '../api';
import type { LeaderboardEntry, LeaderboardResponse, PlayerStats } from '../api';

vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), getLeaderboard: vi.fn() }));

const session: Session = { idToken: 'tok', expiresAt: Date.now() + 3_600_000, user: { userId: 'u1', email: 'ada@example.com', displayName: 'ada', isAdmin: false } };
const wallet: WalletValue = {
  balance: 1000,
  wager: () => true,
  settle: () => {},
  flush: async () => {},
  refresh: async () => {},
  status: 'saved',
  dismissNotice: () => {},
};

const renderBoard = () =>
  render(
    <SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <WalletContext.Provider value={wallet}>
        <Leaderboard />
      </WalletContext.Provider>
    </SessionContext.Provider>,
  );

const NONE: PlayerStats = { wins: 0, draws: 0, losses: 0, seconds: 0, games: [] };
const BOB: PlayerStats = {
  wins: 14,
  draws: 3,
  losses: 9,
  seconds: 7500, // 2h 5m
  games: [
    { game: 'slots', wins: 2, draws: 1, losses: 1, seconds: 3600 },
    { game: 'gin-rummy', wins: 12, draws: 2, losses: 8, seconds: 3900 },
  ],
};
const entry = (rank: number, displayName: string, coins: number, stats?: PlayerStats): LeaderboardEntry => ({ rank, displayName, coins, ...(stats && { stats }) });
const board = (over: Partial<LeaderboardResponse> = {}): LeaderboardResponse => ({
  entries: [entry(1, 'bob', 5000, BOB), entry(2, 'ada', 4000, NONE), entry(3, 'cleo', 1200, { wins: 1, draws: 0, losses: 0, seconds: 40, games: [{ game: 'roulette', wins: 1, draws: 0, losses: 0, seconds: 40 }] })],
  you: entry(2, 'ada', 4000, NONE),
  total: 3,
  ...over,
});

const rowOf = (name: string) => screen.getByRole('cell', { name: new RegExp(`^${name}`) }).closest('tr')!;
const cells = (name: string) => Array.from(rowOf(name).querySelectorAll('td')).map((td) => td.textContent!.trim());
const show = (name: string) => screen.getByRole('button', { name: `Show the stats of ${name}` });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getLeaderboard).mockResolvedValue(board());
});
afterEach(() => cleanup());

describe('the leaderboard period', () => {
  it('starts on all time, with three buttons to choose from', async () => {
    renderBoard();
    await screen.findByRole('table');
    const group = screen.getByRole('group', { name: /show stats for/i });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Today', 'This month', 'All time']);
    expect(within(group).getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.getLeaderboard).toHaveBeenCalledWith('tok', 'all');
  });

  it('loads the board again for the period you choose, and marks it as chosen', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(api.getLeaderboard).toHaveBeenLastCalledWith('tok', 'day');
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'This month' }));
    expect(api.getLeaderboard).toHaveBeenLastCalledWith('tok', 'month');
    await user.click(screen.getByRole('button', { name: 'All time' }));
    expect(api.getLeaderboard).toHaveBeenLastCalledWith('tok', 'all');
  });

  it('shows the stats the server sent for the chosen period', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    expect(cells('bob')[3]).toBe('54%');
    vi.mocked(api.getLeaderboard).mockResolvedValue(board({ entries: [entry(1, 'bob', 5000, { wins: 1, draws: 0, losses: 3, seconds: 90, games: [] })], total: 1 }));
    await user.click(screen.getByRole('button', { name: 'Today' }));
    await vi.waitFor(() => expect(cells('bob')[3]).toBe('25%'));
    expect(cells('bob')[4]).toBe('1m');
  });

  it('is clear that the stats are friendly, not proof', async () => {
    renderBoard();
    await screen.findByRole('table');
    expect(screen.getByText(/friendly bragging/i)).toBeInTheDocument();
  });
});

describe('the summary on each row', () => {
  it('shows the win rate and the time played', async () => {
    renderBoard();
    await screen.findByRole('table');
    expect(cells('bob').slice(0, 5)).toEqual(['1', 'bob', '5,000', '54%', '2h 5m']);
    expect(cells('cleo').slice(3, 5)).toEqual(['100%', '40s']);
  });

  it('shows a dash for a player who has not played', async () => {
    renderBoard();
    await screen.findByRole('table');
    expect(cells('ada').slice(3, 5)).toEqual(['–', '–']);
  });

  it('copes with a server that has no stats yet', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue({ entries: [{ rank: 1, displayName: 'bob', coins: 5000 }], you: { rank: 1, displayName: 'bob', coins: 5000 }, total: 1 });
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    expect(cells('bob').slice(0, 5)).toEqual(['1', 'bob (you)', '5,000', '–', '–']);
    await user.click(show('bob'));
    expect(screen.getByText(/no games played/i)).toBeInTheDocument();
  });

  it('keeps the coins first, so the ranking is still by coins', async () => {
    renderBoard();
    await screen.findByRole('table');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Rank', 'Player', 'Coins', 'Win rate', 'Time played', 'All games']);
  });
});

describe('opening a player to see their games', () => {
  it('shows every game they have played, with a coloured bar, the numbers, the win rate and the time', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('bob'));
    const detail = document.querySelector('.stats-detail')!;
    const lines = Array.from(detail.querySelectorAll('.stat-game')).map((li) => li.textContent);
    expect(lines).toEqual([
      expect.stringMatching(/^All games.*14W 3D 9L.*54%.*2h 5m$/),
      expect.stringMatching(/^Slots.*2W 1D 1L.*50%.*1h$/),
      expect.stringMatching(/^Gin Rummy.*12W 2D 8L.*55%.*1h 5m$/),
    ]);
  });

  it('draws each bar in three colours, in proportion', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('bob'));
    const slotsBar = within(document.querySelector('.stats-detail')!).getByRole('img', { name: '2 wins, 1 draws, 1 losses' });
    const widths = ['.bar-win', '.bar-draw', '.bar-loss'].map((c) => (slotsBar.querySelector(c) as HTMLElement).style.width);
    expect(widths).toEqual(['50%', '25%', '25%']);
  });

  it('names the colours in a legend and the letters, so they do not depend on seeing the colours', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('bob'));
    const legend = document.querySelector('.stat-legend')!;
    expect(Array.from(legend.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['Wins', 'Draws', 'Losses']);
    expect(document.querySelector('.record .w')).toHaveTextContent('14W');
    expect(document.querySelector('.record .d')).toHaveTextContent('3D');
    expect(document.querySelector('.record .l')).toHaveTextContent('9L');
  });

  it('reads the numbers out in full for a screen reader', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('bob'));
    expect(screen.getAllByLabelText('14W 3D 9L').length).toBeGreaterThan(0);
    expect(screen.getByRole('img', { name: '14 wins, 3 draws, 9 losses' })).toBeInTheDocument();
  });

  it('opens and closes, and each player separately', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('bob'));
    await user.click(show('cleo'));
    expect(document.querySelectorAll('.stats-detail')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hide the stats of bob' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Hide the stats of bob' }));
    expect(document.querySelectorAll('.stats-detail')).toHaveLength(1);
    expect(show('bob')).toHaveAttribute('aria-expanded', 'false');
  });

  it('says so when a player has not played in the chosen time', async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(show('ada'));
    expect(within(document.querySelector('.stats-detail')!).getByText(/no games played in this time/i)).toBeInTheDocument();
  });
});

describe('your own stats', () => {
  it('are shown below the table when you are outside the top 10', async () => {
    const outside = board({ entries: [entry(1, 'bob', 5000, BOB)], you: entry(14, 'ada', 820, { wins: 3, draws: 0, losses: 1, seconds: 600, games: [{ game: 'blackjack', wins: 3, draws: 0, losses: 1, seconds: 600 }] }), total: 20 });
    vi.mocked(api.getLeaderboard).mockResolvedValue(outside);
    renderBoard();
    await screen.findByRole('table');
    const mine = document.querySelector('.leaderboard-you-stats')!;
    expect(within(mine as HTMLElement).getByRole('heading', { name: 'Your stats' })).toBeInTheDocument();
    expect(mine).toHaveTextContent('Win rate: 75%');
    expect(mine).toHaveTextContent('Time played: 10m');
    expect(mine).toHaveTextContent('Blackjack');
  });

  it('are not repeated when you are already in the top 10', async () => {
    renderBoard();
    await screen.findByRole('table');
    expect(document.querySelector('.leaderboard-you-stats')).toBeNull();
  });
});
