// @vitest-environment jsdom
// Regression: a player went all in on an unloseable game, lost, and ended with double the coins. The balance
// was refreshed from the server in the middle of the game, which wiped the bet but kept the refund.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AbuseEventsProvider } from './abuseEvents';
import { SessionContext, type Session } from './session';
import { WalletProvider, useWallet, type WalletValue } from './wallet';
import * as api from './api';
import { ApiError } from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, listActiveEvents: vi.fn(), claimEvent: vi.fn(), getBalance: vi.fn(), saveBalance: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'a@example.com', displayName: 'Ada', isAdmin: false },
};

let wallet: WalletValue;
function Grab() {
  wallet = useWallet();
  return <p data-testid="balance">{wallet.balance}</p>;
}

/** A server that checks versions like the real one, and takes a while to answer. */
function realisticServer(latencyMs: number, start = 1000) {
  const state = { balance: start, version: 0 };
  return {
    state,
    get: async () => ({ balance: state.balance, version: state.version }),
    save: async (_token: string, req: { balance: number; version: number }) => {
      await new Promise((r) => setTimeout(r, latencyMs));
      if (req.version !== state.version) {
        throw new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: state.balance, version: state.version });
      }
      state.balance = req.balance;
      state.version += 1;
      return { balance: state.balance, version: state.version };
    },
  };
}

const unloseable = {
  eventId: 'safe-1',
  type: 'UNLOSEABLE' as const,
  title: 'ADMIN ABUSE',
  message: "Everybody's next game is unloseable!",
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
};

const pause = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

async function start(server: ReturnType<typeof realisticServer>) {
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
  vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [unloseable] });
  vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'safe-1', claimed: true });
  render(
    <SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <WalletProvider saveDelayMs={20}>
        <AbuseEventsProvider>
          <Grab />
        </AbuseEventsProvider>
      </WalletProvider>
    </SessionContext.Provider>,
  );
  await screen.findByTestId('balance');
  await pause(30); // the event is claimed, so the next game is protected
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('going all in on an unloseable game and losing', () => {
  it.each([0, 5, 30, 80, 150, 400])('gives the stake back, once, when the loss comes after %i ms', async (waitMs) => {
    const server = realisticServer(60);
    await start(server);
    act(() => void wallet.wager(1000));
    await pause(waitMs);
    act(() => wallet.settle(0));
    await pause(600);
    expect(wallet.balance).toBe(1000);
    expect(server.state.balance).toBe(1000);
  });

  it('gives the stake back once when an admin gave coins just before the bet', async () => {
    const server = realisticServer(60);
    await start(server);
    // An admin gives this player 1,000 coins: the server moves on and this browser does not know yet.
    server.state.balance = 2000;
    server.state.version = 1;
    act(() => void wallet.wager(1000)); // all in: the save is turned down as out of date
    await pause(300);
    expect(wallet.notice).toMatch(/changed on another device/i);
    act(() => wallet.settle(0)); // lost
    await pause(400);
    // 2000 after the gift. The protection gives the bet back, so still 2000, not 3000.
    expect(wallet.balance).toBe(2000);
    expect(server.state.balance).toBe(2000);
  });

  it('gives the stake back once when the balance is refreshed while the bet is placed', async () => {
    const server = realisticServer(60);
    await start(server);
    server.state.balance = 2000; // a coin message arrives, so the balance is refreshed...
    server.state.version = 1;
    let refreshing: Promise<void> | undefined;
    act(() => {
      refreshing = wallet.refresh();
    });
    act(() => void wallet.wager(1000)); // ...while the player goes all in
    await act(async () => {
      await refreshing;
    });
    await pause(300);
    act(() => wallet.settle(0));
    await pause(400);
    expect(wallet.balance).toBe(2000);
    expect(server.state.balance).toBe(2000);
  });
});

describe('an ordinary game after a change from elsewhere', () => {
  it('still costs the bet when it is lost', async () => {
    const server = realisticServer(60);
    vi.mocked(api.getBalance).mockImplementation(server.get);
    vi.mocked(api.saveBalance).mockImplementation(server.save);
    vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [] });
    render(
      <SessionContext.Provider value={{ session, logout: vi.fn() }}>
        <WalletProvider saveDelayMs={20}>
          <AbuseEventsProvider>
            <Grab />
          </AbuseEventsProvider>
        </WalletProvider>
      </SessionContext.Provider>,
    );
    await screen.findByTestId('balance');
    await pause(30);
    server.state.balance = 2000; // an admin gives 1,000
    server.state.version = 1;
    act(() => void wallet.wager(500));
    await pause(300);
    act(() => wallet.settle(0)); // lost
    await pause(400);
    expect(wallet.balance).toBe(1500); // 2000 - 500, and not 2000 as if the bet had never happened
    expect(server.state.balance).toBe(1500);
  });
});
