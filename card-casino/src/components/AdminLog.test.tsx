// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AdminLog } from './AdminLog';
import { LanguageProvider, STORAGE_KEY } from '../i18n';
import { SessionContext, type Session } from '../session';
import * as api from '../api';
import { ApiError, type LogEntry } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, searchLogAccounts: vi.fn(), getPlayerLog: vi.fn() };
});

const session: Session = {
  idToken: 'admin-token',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true },
};
const logout = vi.fn();

const renderIt = () =>
  render(
    <LanguageProvider>
      <SessionContext.Provider value={{ session, logout }}>
        <AdminLog />
      </SessionContext.Provider>
    </LanguageProvider>,
  );

const ada = { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', status: 'ACTIVE' as const };
const pendingAdam = { userId: 'u2', email: 'adam@example.com', displayName: 'Adam', status: 'PENDING' as const };

const entry = (type: LogEntry['type'], details: Record<string, unknown>, n = 1): LogEntry => ({
  logId: `l${n}`,
  type,
  createdAt: `2026-11-13T10:0${n}:00.000Z`,
  details,
});

async function openLogOf(account = ada, entries: LogEntry[] = [], next?: string) {
  vi.mocked(api.searchLogAccounts).mockResolvedValue({ users: [account], truncated: false });
  vi.mocked(api.getPlayerLog).mockResolvedValue({ entries, next });
  renderIt();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/find a player/i), 'ad');
  await user.click(screen.getByRole('button', { name: /^find$/i }));
  await user.click(await screen.findByRole('button', { name: new RegExp(`show log.*${account.displayName}`, 'i') }));
  return user;
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('finding an account', () => {
  it('searches any account state and shows name, email and status', async () => {
    vi.mocked(api.searchLogAccounts).mockResolvedValue({ users: [ada, pendingAdam], truncated: false });
    renderIt();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/find a player/i), 'ad');
    await user.click(screen.getByRole('button', { name: /^find$/i }));
    expect(api.searchLogAccounts).toHaveBeenCalledWith('admin-token', 'ad');
    expect(await screen.findByText('adam@example.com')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('asks for at least two letters', async () => {
    renderIt();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/find a player/i), 'a');
    await user.click(screen.getByRole('button', { name: /^find$/i }));
    expect(api.searchLogAccounts).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('says so when nobody matches', async () => {
    vi.mocked(api.searchLogAccounts).mockResolvedValue({ users: [], truncated: false });
    renderIt();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/find a player/i), 'zz');
    await user.click(screen.getByRole('button', { name: /^find$/i }));
    expect(await screen.findByText(/nobody matches/i)).toBeInTheDocument();
  });

  it('logs out when the session is rejected', async () => {
    vi.mocked(api.searchLogAccounts).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    renderIt();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/find a player/i), 'ad');
    await user.click(screen.getByRole('button', { name: /^find$/i }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

describe('reading the log', () => {
  it('asks for the newest entries of the chosen account', async () => {
    await openLogOf();
    expect(api.getPlayerLog).toHaveBeenCalledWith('admin-token', 'u1', {});
    expect(await screen.findByText(/nothing logged/i)).toBeInTheDocument();
  });

  it('describes a balance change with before, after and the difference', async () => {
    await openLogOf(ada, [entry('balance', { before: 1000, after: 1250, delta: 250 })]);
    expect(await screen.findByText('Balance 1,000 → 1,250 (+250)')).toBeInTheDocument();
  });

  it('describes a fall in the balance with a minus', async () => {
    await openLogOf(ada, [entry('balance', { before: 1000, after: 900, delta: -100 })]);
    expect(await screen.findByText('Balance 1,000 → 900 (-100)')).toBeInTheDocument();
  });

  it('describes logins, good and bad', async () => {
    await openLogOf(ada, [
      entry('login', { ok: true }, 3),
      entry('login', { ok: false, reason: 'badPassword' }, 2),
      entry('login', { ok: false, reason: 'pending' }, 1),
    ]);
    expect(await screen.findByText('Logged in')).toBeInTheDocument();
    expect(screen.getByText('Failed login: wrong password')).toBeInTheDocument();
    expect(screen.getByText('Login refused: waiting for approval')).toBeInTheDocument();
  });

  it('describes coins given or taken by an admin, and who did it', async () => {
    await openLogOf(ada, [
      entry('adminCoins', { amount: 500, balanceAfter: 1500, by: 'Boss' }, 2),
      entry('adminCoins', { amount: -200, balanceAfter: 800, by: 'Boss' }, 1),
    ]);
    expect(await screen.findByText('Admin coins: +500 from Boss (balance 1,500)')).toBeInTheDocument();
    expect(screen.getByText('Admin coins: -200 from Boss (balance 800)')).toBeInTheDocument();
  });

  it('describes the steps of an account', async () => {
    await openLogOf(ada, [
      entry('account', { step: 'approved', by: 'Boss' }, 3),
      entry('account', { step: 'confirmed' }, 2),
      entry('account', { step: 'registered' }, 1),
    ]);
    expect(await screen.findByText('Approved by Boss')).toBeInTheDocument();
    expect(screen.getByText('Email confirmed')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
  });

  it('describes an admin event that was claimed', async () => {
    await openLogOf(ada, [entry('event', { eventType: 'coinDrop' })]);
    expect(await screen.findByText('Claimed an event: coinDrop')).toBeInTheDocument();
  });

  it('shows the time of each entry', async () => {
    await openLogOf(ada, [entry('login', { ok: true })]);
    expect(await screen.findByText(/2026-11-13 10:01/)).toBeInTheDocument();
  });

  it('shows a confirmed win, and whether it was announced', async () => {
    await openLogOf(ada, [entry('win', { win: 'royalFlush', prize: 7990, bet: 10, confirmed: true, announced: true })]);
    expect(await screen.findByText(/won 7,990 coins/)).toHaveTextContent('Royal flush');
    expect(screen.getByText('Announced')).toBeInTheDocument();
    expect(screen.queryByText(/unconfirmed/i)).not.toBeInTheDocument();
  });

  it('marks a win the balance did not back up as unconfirmed', async () => {
    await openLogOf(ada, [
      entry('win', { win: 'royalFlush', prize: 5000, confirmed: false, announced: false, reason: 'notBackedByBalance' }),
    ]);
    expect(await screen.findByText('Unconfirmed: the balance does not show this win')).toBeInTheDocument();
    expect(screen.queryByText('Announced')).not.toBeInTheDocument();
  });

  it('says when a real win was not announced because of the one-a-minute limit', async () => {
    await openLogOf(ada, [entry('win', { win: 'slotsJackpot', prize: 900, confirmed: true, announced: false, reason: 'rateLimited' })]);
    expect(await screen.findByText('Not announced: one a minute')).toBeInTheDocument();
  });

  it('never shows an email, a device or an address in an entry', async () => {
    await openLogOf(ada, [entry('login', { ok: true })]);
    const list = await screen.findByRole('list', { name: /log entries/i });
    expect(within(list).queryByText(/@/)).not.toBeInTheDocument();
  });
});

describe('narrowing and paging', () => {
  it('shows only one kind of entry when a chip is chosen', async () => {
    const user = await openLogOf(ada, [entry('balance', { before: 1, after: 2, delta: 1 })]);
    await user.click(await screen.findByRole('button', { name: 'Wins' }));
    expect(api.getPlayerLog).toHaveBeenLastCalledWith('admin-token', 'u1', { type: 'win' });
  });

  it('goes back to every kind with the All chip', async () => {
    const user = await openLogOf(ada, []);
    await user.click(await screen.findByRole('button', { name: 'Logins' }));
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(api.getPlayerLog).toHaveBeenLastCalledWith('admin-token', 'u1', {});
  });

  it('offers Show more only when there is a next page, and adds it below', async () => {
    const user = await openLogOf(ada, [entry('login', { ok: true }, 2)], 'marker-1');
    vi.mocked(api.getPlayerLog).mockResolvedValue({ entries: [entry('account', { step: 'registered' }, 1)] });
    await user.click(await screen.findByRole('button', { name: /show more/i }));
    expect(api.getPlayerLog).toHaveBeenLastCalledWith('admin-token', 'u1', { before: 'marker-1' });
    expect(await screen.findByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('has no Show more on the last page', async () => {
    await openLogOf(ada, [entry('login', { ok: true })]);
    await screen.findByText('Logged in');
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
  });

  it('says so when the log cannot be loaded', async () => {
    vi.mocked(api.searchLogAccounts).mockResolvedValue({ users: [ada], truncated: false });
    vi.mocked(api.getPlayerLog).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderIt();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/find a player/i), 'ad');
    await user.click(screen.getByRole('button', { name: /^find$/i }));
    await user.click(await screen.findByRole('button', { name: /show log/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });
});

describe('in Chinese', () => {
  it('words the section in Chinese', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    renderIt();
    expect(screen.getByRole('heading', { name: '玩家日志' })).toBeInTheDocument();
  });
});
