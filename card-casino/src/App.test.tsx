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
  return { ...actual, listPendingUsers: vi.fn(), approveUser: vi.fn(), getBalance: vi.fn(), saveBalance: vi.fn() };
});

const sessionFor = (isAdmin: boolean): Session => ({
  idToken: 'tok',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: isAdmin ? 'Boss' : 'Ada', isAdmin },
});

const logout = vi.fn();
async function renderApp(isAdmin: boolean) {
  render(
    <SessionContext.Provider value={{ session: sessionFor(isAdmin), logout }}>
      <WalletProvider>
        <App />
      </WalletProvider>
    </SessionContext.Provider>,
  );
  // The casino only appears once the balance has loaded from the server.
  await screen.findByRole('button', { name: /log out/i });
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(api.getBalance).mockResolvedValue({ balance: 1000, version: 0 });
  vi.mocked(api.saveBalance).mockImplementation(async (_t, req) => ({ balance: req.balance, version: req.version + 1 }));
});
afterEach(() => cleanup());

describe('casino header', () => {
  it('shows the ADMIN ONLY button to admins', async () => {
    await renderApp(true);
    expect(screen.getByRole('button', { name: 'ADMIN ONLY' })).toBeInTheDocument();
  });

  it('hides the ADMIN ONLY button from regular users', async () => {
    await renderApp(false);
    expect(screen.queryByRole('button', { name: 'ADMIN ONLY' })).not.toBeInTheDocument();
  });

  it('opens the admin panel from ADMIN ONLY and returns to the game', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    await renderApp(true);
    await user.click(screen.getByRole('button', { name: 'ADMIN ONLY' }));
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to game/i }));
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('logs out through the session', async () => {
    const user = userEvent.setup();
    await renderApp(false);
    await user.click(screen.getByRole('button', { name: /log out/i }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

describe('coins', () => {
  it("shows the account's own balance from the server", async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 4321, version: 9 });
    await renderApp(false);
    expect(screen.getByText(/4,321 coins/i)).toBeInTheDocument();
  });

  it('offers a refill when the account is out of coins', async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 0, version: 3 });
    const user = userEvent.setup();
    await renderApp(false);
    await user.click(screen.getByRole('button', { name: /claim 500 coins/i }));
    expect(screen.getByText(/500 coins/i)).toBeInTheDocument();
  });
});
