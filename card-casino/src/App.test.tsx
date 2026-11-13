// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { WalletProvider } from './wallet';
import { SessionContext, type Session } from './session';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, listPendingUsers: vi.fn(), approveUser: vi.fn() };
});

const sessionFor = (isAdmin: boolean): Session => ({
  idToken: 'tok',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: isAdmin ? 'Boss' : 'Ada', isAdmin },
});

const logout = vi.fn();
const renderApp = (isAdmin: boolean) =>
  render(
    <SessionContext.Provider value={{ session: sessionFor(isAdmin), logout }}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </SessionContext.Provider>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('casino header', () => {
  it('shows the ADMIN ONLY button to admins', () => {
    renderApp(true);
    expect(screen.getByRole('button', { name: 'ADMIN ONLY' })).toBeInTheDocument();
  });

  it('hides the ADMIN ONLY button from regular users', () => {
    renderApp(false);
    expect(screen.queryByRole('button', { name: 'ADMIN ONLY' })).not.toBeInTheDocument();
  });

  it('opens the admin panel from ADMIN ONLY and returns to the game', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    renderApp(true);
    await user.click(screen.getByRole('button', { name: 'ADMIN ONLY' }));
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to game/i }));
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('logs out through the session', async () => {
    const user = userEvent.setup();
    renderApp(false);
    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(logout).toHaveBeenCalled();
  });
});
