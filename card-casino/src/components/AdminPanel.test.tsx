// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AdminPanel } from './AdminPanel';
import { SessionContext, type Session } from '../session';
import * as api from '../api';
import { ApiError } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, listPendingUsers: vi.fn(), approveUser: vi.fn() };
});

const session: Session = {
  idToken: 'admin-token',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true },
};
const logout = vi.fn();

const renderPanel = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <AdminPanel />
    </SessionContext.Provider>,
  );

const pending = [
  { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', createdAt: '2026-11-01T10:00:00.000Z' },
  { userId: 'u2', email: 'bob@example.com', displayName: 'Bob', createdAt: '2026-11-02T10:00:00.000Z' },
];

beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe('admin panel', () => {
  it('lists the users waiting for approval', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: pending });
    renderPanel();
    expect(screen.getByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(api.listPendingUsers).toHaveBeenCalledWith('admin-token');
  });

  it('says so when nobody is waiting', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    renderPanel();
    expect(await screen.findByText(/no accounts are waiting/i)).toBeInTheDocument();
  });

  it('approves a user and removes them from the list', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: pending });
    vi.mocked(api.approveUser).mockResolvedValue({ userId: 'u1', status: 'ACTIVE' });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ada');
    await user.click(screen.getByRole('button', { name: /approve ada/i }));
    expect(api.approveUser).toHaveBeenCalledWith('admin-token', 'u1');
    await vi.waitFor(() => expect(screen.queryByText('Ada')).not.toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('keeps the user listed and shows an error when approval fails', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: pending });
    vi.mocked(api.approveUser).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Ada');
    await user.click(screen.getByRole('button', { name: /approve ada/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not approve ada/i);
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('shows an error if the list cannot be loaded', async () => {
    vi.mocked(api.listPendingUsers).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
  });

  it('logs out when the session has expired', async () => {
    vi.mocked(api.listPendingUsers).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    renderPanel();
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('shows each waiting user in its own row', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: pending });
    renderPanel();
    const rows = await screen.findAllByRole('row');
    const bob = rows.find((r) => within(r).queryByText('Bob'))!;
    expect(within(bob).getByRole('button', { name: /approve bob/i })).toBeInTheDocument();
  });
});
