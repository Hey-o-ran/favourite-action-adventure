// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { App } from './App';
import { WalletProvider } from './wallet';
import { AbuseEventsProvider } from './abuseEvents';
import { SessionContext, type Session } from './session';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return {
    ...actual,
    listPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    getBalance: vi.fn(),
    saveBalance: vi.fn(),
    listActiveEvents: vi.fn(),
    getLeaderboard: vi.fn(),
    claimEvent: vi.fn(),
  };
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
  await screen.findByRole('button', { name: /menu/i });
}

// Built from pieces so the real password is not written in this file.
const ADMIN_PASSWORD = ['Gre@t', 'Gl@g', 'VSE', 'nf0s0'].join('');

/** Opens the Menu and presses one of its items. */
async function pickFromMenu(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(screen.getByRole('button', { name: /menu/i }));
  await user.click(screen.getByRole('menuitem', { name }));
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(api.getBalance).mockResolvedValue({ balance: 1000, version: 0 });
  vi.mocked(api.saveBalance).mockImplementation(async (_t, req) => ({ balance: req.balance, version: req.version + 1 }));
});
afterEach(() => cleanup());

describe('casino header', () => {
  it('shows the ADMIN ONLY item to admins', async () => {
    const user = userEvent.setup();
    await renderApp(true);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('menuitem', { name: 'ADMIN ONLY' })).toBeInTheDocument();
  });

  it('hides the ADMIN ONLY item from regular users', async () => {
    const user = userEvent.setup();
    await renderApp(false);
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.queryByRole('menuitem', { name: 'ADMIN ONLY' })).not.toBeInTheDocument();
  });

  it('opens the admin panel from ADMIN ONLY and returns to the game', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    await renderApp(true);
    await pickFromMenu(user, 'ADMIN ONLY');
    await user.type(await screen.findByLabelText(/password/i), `${ADMIN_PASSWORD}{Enter}`);
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    await pickFromMenu(user, /back to game/i);
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('asks for the admin password first, and shows nothing of the panel until it is right', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    await renderApp(true);
    await pickFromMenu(user, 'ADMIN ONLY');
    expect(await screen.findByRole('dialog', { name: /admin access/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
    expect(api.listPendingUsers).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/password/i), 'wrong{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/i);
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
    expect(api.listPendingUsers).not.toHaveBeenCalled();
  });

  it('can leave the password page without entering anything, and does not ask again once you are in', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    await renderApp(true);
    await pickFromMenu(user, 'ADMIN ONLY');
    await user.click(await screen.findByRole('button', { name: /back to game/i }));
    expect(screen.queryByRole('dialog', { name: /admin access/i })).not.toBeInTheDocument();

    await pickFromMenu(user, 'ADMIN ONLY');
    await user.type(await screen.findByLabelText(/password/i), `${ADMIN_PASSWORD}{Enter}`);
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    await pickFromMenu(user, /back to game/i);
    await pickFromMenu(user, 'ADMIN ONLY');
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /admin access/i })).not.toBeInTheDocument();
  });

  it('logs out through the session', async () => {
    const user = userEvent.setup();
    await renderApp(false);
    await pickFromMenu(user, /log out/i);
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

describe('coins', () => {
  it("shows the account's own balance from the server", async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 4321, version: 9 });
    await renderApp(false);
    expect(screen.getByText(/4,321 coins/i)).toBeInTheDocument();
  });

  it('does not offer a free refill when the account is out of coins', async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 0, version: 3 });
    await renderApp(false);
    expect(screen.getByText(/^0\s*coins$/i, { selector: '.balance' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/out of coins/i)).not.toBeInTheDocument();
  });
});

describe('admin abuse announcements', () => {
  it('appear at the very top of the screen, above the header, and the effect shows in the balance', async () => {
    vi.mocked(api.listActiveEvents).mockResolvedValue({
      events: [
        {
          eventId: 'e1',
          type: 'FREE_COINS',
          title: 'ADMIN ABUSE',
          message: 'Everyone gets 1,000 coins!',
          amount: 1000,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      ],
    });
    vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'e1', claimed: true });
    render(
      <SessionContext.Provider value={{ session: sessionFor(false), logout }}>
        <WalletProvider>
          <AbuseEventsProvider>
            <App />
          </AbuseEventsProvider>
        </WalletProvider>
      </SessionContext.Provider>,
    );

    const announcement = await screen.findByText('Everyone gets 1,000 coins!');
    const title = screen.getByRole('heading', { name: /bintarland bank - bibergly betting business/i });
    // The announcement comes before the page title in the document.
    expect(announcement.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByText(/2,000 coins/)).toBeInTheDocument(); // 1,000 to start plus the 1,000 gift
  });

  it('show nothing at all when no event is on', async () => {
    vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [] });
    render(
      <SessionContext.Provider value={{ session: sessionFor(false), logout }}>
        <WalletProvider>
          <AbuseEventsProvider>
            <App />
          </AbuseEventsProvider>
        </WalletProvider>
      </SessionContext.Provider>,
    );
    await vi.waitFor(() => expect(api.listActiveEvents).toHaveBeenCalled());
    expect(screen.queryByText('ADMIN ABUSE')).not.toBeInTheDocument();
  });
});

describe('leaderboard button', () => {
  it('is there for every player, opens the leaderboard, and goes back to the game', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue({
      entries: [{ rank: 1, displayName: 'Ada', coins: 1000 }],
      you: { rank: 1, displayName: 'Ada', coins: 1000 },
      total: 1,
    });
    const user = userEvent.setup();
    await renderApp(false);
    await pickFromMenu(user, 'Leaderboard');
    expect(await screen.findByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();

    await pickFromMenu(user, /back to game/i);
    expect(screen.queryByRole('heading', { name: /leaderboard/i })).not.toBeInTheDocument();
  });

  it('is also there for admins, and switching to another page replaces it', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue({ entries: [], total: 0 });
    vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
    const user = userEvent.setup();
    await renderApp(true);
    await pickFromMenu(user, 'Leaderboard');
    expect(await screen.findByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    await pickFromMenu(user, "What's new");
    // The update log mentions the leaderboard in a heading of its own, so look for the page itself.
    expect(document.querySelector('.leaderboard')).toBeNull();
    expect(screen.getByRole('heading', { name: /the leaderboard!/i })).toBeInTheDocument();
  });
});
