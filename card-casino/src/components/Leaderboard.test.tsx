// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { Leaderboard } from './Leaderboard';
import { SessionContext, type Session } from '../session';
import { WalletContext, type WalletValue } from '../wallet';
import * as api from '../api';
import { ApiError, type LeaderboardEntry, type LeaderboardResponse } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, getLeaderboard: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'ada@example.com', displayName: 'ada', isAdmin: false },
};
const logout = vi.fn();
const flush = vi.fn<() => Promise<void>>();

const wallet: WalletValue = {
  balance: 1000,
  wager: () => true,
  settle: () => {},
  flush: () => flush(),
  status: 'saved',
  dismissNotice: () => {},
};

const renderBoard = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <WalletContext.Provider value={wallet}>
        <Leaderboard />
      </WalletContext.Provider>
    </SessionContext.Provider>,
  );

const entry = (rank: number, displayName: string, coins: number): LeaderboardEntry => ({ rank, displayName, coins });
const board = (over: Partial<LeaderboardResponse> = {}): LeaderboardResponse => ({
  entries: [entry(1, 'bob', 5000), entry(2, 'ada', 4000), entry(3, 'cleo', 1200)],
  you: entry(2, 'ada', 4000),
  total: 3,
  ...over,
});
const tenAndMe = (): LeaderboardResponse => ({
  entries: Array.from({ length: 10 }, (_, i) => entry(i + 1, `p${String(i + 1).padStart(2, '0')}`, 2000 - i * 100)),
  you: entry(14, 'ada', 820),
  total: 20,
});

/** The names and coins in the table, top to bottom. */
const rows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim()));

beforeEach(() => {
  vi.resetAllMocks();
  flush.mockResolvedValue();
});
afterEach(() => cleanup());

describe('leaderboard page', () => {
  it('lists the top players in order with their rank and coins', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    renderBoard();
    expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    await screen.findByRole('table');
    expect(rows()).toEqual([
      ['1', 'bob', '5,000'],
      ['2', 'ada (you)', '4,000'],
      ['3', 'cleo', '1,200'],
    ]);
    expect(api.getLeaderboard).toHaveBeenCalledWith('tok');
  });

  it('shows a loading message until the board arrives', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    renderBoard();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await screen.findByRole('table');
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('highlights your own line, and only yours', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    renderBoard();
    await screen.findByRole('table');
    const mine = screen.getAllByRole('row').filter((r) => r.classList.contains('me'));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toHaveTextContent('ada');
    expect(screen.getAllByText(/\(you\)/)).toHaveLength(1);
  });

  it('does not repeat your place when you are already in the top 10', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    renderBoard();
    await screen.findByRole('table');
    expect(screen.queryByText(/you're/i)).not.toBeInTheDocument();
  });

  it('tells you your place when you are outside the top 10', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(tenAndMe());
    renderBoard();
    await screen.findByRole('table');
    expect(rows()).toHaveLength(10);
    expect(screen.getByText(/you're/i)).toHaveTextContent("You're #14 with 820 coins.");
    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument(); // you are not in the table
  });

  it('shows shared ranks as they are', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(
      board({ entries: [entry(1, 'ada', 500), entry(1, 'bob', 500), entry(3, 'cleo', 300)], you: entry(3, 'cleo', 300) }),
    );
    renderBoard();
    await screen.findByRole('table');
    expect(rows().map((r) => r[0])).toEqual(['1', '1', '3']);
  });

  it('says how many players there are, with the right grammar', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board({ total: 20 }));
    const first = renderBoard();
    expect(await screen.findByText(/20 players in all/i)).toBeInTheDocument();
    first.unmount();

    vi.mocked(api.getLeaderboard).mockResolvedValue(board({ entries: [entry(1, 'ada', 5)], you: entry(1, 'ada', 5), total: 1 }));
    renderBoard();
    expect(await screen.findByText(/1 player in all/i)).toBeInTheDocument();
  });

  it('works for someone who is not a player, such as an admin account', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board({ you: undefined }));
    renderBoard();
    await screen.findByRole('table');
    expect(screen.queryByText(/\(you\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/you're/i)).not.toBeInTheDocument();
  });

  it('says so when nobody is on the board yet', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue({ entries: [], total: 0 });
    renderBoard();
    expect(await screen.findByText(/nobody is on the board yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('formats big numbers of coins', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board({ entries: [entry(1, 'ada', 10_000_000)], you: entry(1, 'ada', 10_000_000), total: 1 }));
    renderBoard();
    await screen.findByRole('table');
    expect(rows()[0][2]).toBe('10,000,000');
  });
});

describe('leaderboard loading', () => {
  it('saves your latest balance before asking for the board', async () => {
    const order: string[] = [];
    flush.mockImplementation(async () => void order.push('save'));
    vi.mocked(api.getLeaderboard).mockImplementation(async () => {
      order.push('load');
      return board();
    });
    renderBoard();
    await screen.findByRole('table');
    expect(order).toEqual(['save', 'load']);
  });

  it('still shows the board if saving your balance fails', async () => {
    flush.mockRejectedValue(new Error('offline'));
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    renderBoard();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows an error with a way to try again, then the board', async () => {
    vi.mocked(api.getLeaderboard)
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x'))
      .mockResolvedValue(board());
    const user = userEvent.setup();
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the leaderboard/i);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the same friendly error when the server cannot be reached', async () => {
    vi.mocked(api.getLeaderboard).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'down'));
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the leaderboard/i);
    expect(logout).not.toHaveBeenCalled();
  });

  it('shows the same friendly error while the leaderboard route does not exist yet', async () => {
    vi.mocked(api.getLeaderboard).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Route not found'));
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the leaderboard/i);
  });

  it('logs you out if your login has expired', async () => {
    vi.mocked(api.getLeaderboard).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in'));
    renderBoard();
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('loads again when you press Refresh, and shows the new standings', async () => {
    vi.mocked(api.getLeaderboard)
      .mockResolvedValueOnce(board())
      .mockResolvedValue(board({ entries: [entry(1, 'ada', 9000), entry(2, 'bob', 5000)], you: entry(1, 'ada', 9000), total: 2 }));
    const user = userEvent.setup();
    renderBoard();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await vi.waitFor(() => expect(rows()[0]).toEqual(['1', 'ada (you)', '9,000']));
    expect(api.getLeaderboard).toHaveBeenCalledTimes(2);
  });
});
