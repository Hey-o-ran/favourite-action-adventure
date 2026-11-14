// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AbuseEventsProvider, POLL_MS } from './abuseEvents';
import { AnnouncementBar } from './components/AnnouncementBar';
import { SessionContext, type Session } from './session';
import { WalletProvider, useWallet } from './wallet';
import * as api from './api';
import { ApiError, type AbuseEvent } from './api';
import { fakeBalanceServer } from './testBalanceServer';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, listActiveEvents: vi.fn(), claimEvent: vi.fn(), getBalance: vi.fn(), saveBalance: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', isAdmin: false },
};
const logout = vi.fn();

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const freeCoins = (over: Partial<AbuseEvent> = {}): AbuseEvent => ({
  eventId: 'coins-1',
  type: 'FREE_COINS',
  title: 'ADMIN ABUSE',
  message: 'Everyone gets 1,000 coins!',
  amount: 1000,
  startedAt: new Date().toISOString(),
  expiresAt: inMinutes(10),
  ...over,
});
const unloseable = (over: Partial<AbuseEvent> = {}): AbuseEvent => ({
  eventId: 'safe-1',
  type: 'UNLOSEABLE',
  title: 'ADMIN ABUSE',
  message: "Everybody's next game is unloseable!",
  startedAt: new Date().toISOString(),
  expiresAt: inMinutes(10),
  ...over,
});

/** A stand-in for a game: it wagers and settles through the wallet like the real games do. */
function TestGame() {
  const { balance, wager, settle } = useWallet();
  return (
    <div>
      <p data-testid="balance">{balance}</p>
      <button onClick={() => wager(100)}>Bet 100</button>
      <button onClick={() => settle(0)}>Lose</button>
      <button onClick={() => settle(40)}>Get 40 back</button>
      <button onClick={() => settle(250)}>Win 250</button>
    </div>
  );
}

const tree = () => (
  <SessionContext.Provider value={{ session, logout }}>
    <WalletProvider>
      <AbuseEventsProvider>
        <AnnouncementBar />
        <TestGame />
      </AbuseEventsProvider>
    </WalletProvider>
  </SessionContext.Provider>
);

/** Renders and lets the first poll finish. */
async function start(events: AbuseEvent[] = []) {
  vi.mocked(api.listActiveEvents).mockResolvedValue({ events });
  const view = render(tree());
  await screen.findByTestId('balance');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return view;
}
const poll = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_MS);
  });
const balance = () => Number(screen.getByTestId('balance').textContent);

// What the server holds for the player. The wallet loads from it and saves back to it.
let server = fakeBalanceServer();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  server = fakeBalanceServer();
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
  vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'x', claimed: true });
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('free coins', () => {
  it('announces the event and pays the coins into the balance', async () => {
    await start([freeCoins()]);
    expect(screen.getByText('ADMIN ABUSE')).toBeInTheDocument();
    expect(screen.getByText('Everyone gets 1,000 coins!')).toBeInTheDocument();
    expect(screen.getByText(/\+1,000 coins are in your balance/i)).toBeInTheDocument();
    expect(balance()).toBe(2000); // the 1,000 starting coins plus the gift
    expect(api.claimEvent).toHaveBeenCalledWith('tok', 'coins-1');
  });

  it('pays only once, however many times it checks', async () => {
    await start([freeCoins()]);
    await poll();
    await poll();
    expect(api.listActiveEvents).toHaveBeenCalledTimes(3);
    expect(api.claimEvent).toHaveBeenCalledTimes(1);
    expect(balance()).toBe(2000);
  });

  it('does not pay again after a reload, because it remembers the event', async () => {
    const first = await start([freeCoins()]);
    first.unmount();
    server.state.balance = 2000; // the balance the first visit saved to the server
    await start([freeCoins()]);
    expect(api.claimEvent).toHaveBeenCalledTimes(1);
    expect(balance()).toBe(2000);
  });

  it('pays nothing if the server says it was already taken (another device)', async () => {
    vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'coins-1', claimed: false });
    await start([freeCoins()]);
    expect(balance()).toBe(1000);
    expect(screen.getByText(/you already took this one/i)).toBeInTheDocument();
  });

  it('pays whatever amount the admin chose', async () => {
    await start([freeCoins({ amount: 2500, message: 'Everyone gets 2,500 coins!' })]);
    expect(balance()).toBe(3500);
    expect(screen.getByText(/\+2,500 coins/i)).toBeInTheDocument();
  });

  it('ignores an event whose time is already up', async () => {
    await start([freeCoins({ expiresAt: new Date(Date.now() - 1000).toISOString() })]);
    expect(screen.queryByText('ADMIN ABUSE')).not.toBeInTheDocument();
    expect(api.claimEvent).not.toHaveBeenCalled();
    expect(balance()).toBe(1000);
  });

  it('lets you dismiss the announcement', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await start([freeCoins()]);
    await user.click(screen.getByRole('button', { name: /dismiss: everyone gets 1,000 coins/i }));
    expect(screen.queryByText('Everyone gets 1,000 coins!')).not.toBeInTheDocument();
    expect(balance()).toBe(2000); // dismissing the message keeps the coins
  });

  it('shows nothing when no event is on', async () => {
    await start([]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('who started it', () => {
  it('shows the admin\'s name with a blue check, so nobody can pass themselves off as the admin', async () => {
    await start([freeCoins({ announcedBy: { displayName: 'boss', verified: true } })]);
    const from = screen.getByText(/^from/);
    expect(from).toHaveTextContent('from boss');
    expect(within(from).getByRole('img', { name: /verified admin/i })).toBeInTheDocument();
  });

  it('shows no name or check on an event that has no admin recorded', async () => {
    await start([freeCoins()]);
    expect(screen.queryByText(/^from/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /verified admin/i })).not.toBeInTheDocument();
  });

  it('shows it on an unloseable event too', async () => {
    await start([unloseable({ announcedBy: { displayName: 'boss', verified: true } })]);
    expect(screen.getByRole('img', { name: /verified admin/i })).toBeInTheDocument();
  });
});

describe('an unloseable next game', () => {
  const setup = async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await start([unloseable()]);
    return user;
  };

  it('announces it and shows you are protected', async () => {
    await setup();
    expect(screen.getByText("Everybody's next game is unloseable!")).toBeInTheDocument();
    expect(screen.getByText(/your next game is unloseable\. it can't cost you any coins/i)).toBeInTheDocument();
    expect(balance()).toBe(1000); // nothing is paid yet
  });

  it('refunds the stake when the protected game is lost', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    expect(balance()).toBe(900);
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(1000);
    expect(screen.getByText(/you got 100 coins back/i)).toBeInTheDocument();
  });

  it('uses the protection up, so the game after that can lose', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(screen.queryByText(/your next game is unloseable\. it can't cost/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(900); // a normal loss
  });

  it('tops a partial return up to the stake', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Get 40 back' }));
    expect(balance()).toBe(1000);
    expect(screen.getByText(/you got 60 coins back/i)).toBeInTheDocument();
  });

  it('keeps your winnings as normal when you win, and still uses the protection up', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Win 250' }));
    expect(balance()).toBe(1150); // 900 plus 250, with no extra top-up
    expect(screen.queryByText(/coins back/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your next game is unloseable\. it can't cost/i)).not.toBeInTheDocument();
  });

  it('covers every wager in the game, such as a double down', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    expect(balance()).toBe(800);
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(1000);
  });

  it('does not count a settle with no wager behind it', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Win 250' }));
    expect(balance()).toBe(1250);
    expect(screen.getByText(/your next game is unloseable\. it can't cost/i)).toBeInTheDocument(); // still protected
  });

  it('is only given once per event', async () => {
    const user = await setup();
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    await poll(); // the same event is still on, but it was already taken
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(900);
    expect(api.claimEvent).toHaveBeenCalledTimes(1);
  });

  it('survives a reload before you play, even if the event has ended', async () => {
    const first = await setup();
    void first;
    cleanup();
    await start([]); // the event is over, but you still carry its protection
    expect(screen.getByText(/your next game is unloseable\. it can't cost/i)).toBeInTheDocument();
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(1000);
  });

  it('gives nobody protection if the server says it was already taken', async () => {
    vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'safe-1', claimed: false });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    await start([unloseable()]);
    await user.click(screen.getByRole('button', { name: 'Bet 100' }));
    await user.click(screen.getByRole('button', { name: 'Lose' }));
    expect(balance()).toBe(900);
  });
});

describe('when things go wrong', () => {
  it('carries on quietly if the server cannot be reached', async () => {
    vi.mocked(api.listActiveEvents).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'down'));
    render(tree());
    await screen.findByTestId('balance');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('balance')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('carries on quietly if the events service does not exist yet', async () => {
    vi.mocked(api.listActiveEvents).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Route not found'));
    render(tree());
    await screen.findByTestId('balance');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('retries a claim that failed to get through, and pays once', async () => {
    vi.mocked(api.claimEvent)
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'dropped'))
      .mockResolvedValue({ eventId: 'coins-1', claimed: true });
    await start([freeCoins()]);
    expect(balance()).toBe(1000); // the first claim never arrived
    await poll();
    expect(balance()).toBe(2000);
    await poll();
    expect(balance()).toBe(2000);
  });

  it('gives up on an event that ended before it could be claimed', async () => {
    vi.mocked(api.claimEvent).mockRejectedValue(new ApiError(410, 'EVENT_ENDED', 'This event has ended'));
    await start([freeCoins()]);
    await poll();
    expect(api.claimEvent).toHaveBeenCalledTimes(1); // not retried
    expect(balance()).toBe(1000);
  });

  it('logs you out if the login has expired', async () => {
    vi.mocked(api.listActiveEvents).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in'));
    render(tree());
    await screen.findByTestId('balance');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(logout).toHaveBeenCalled();
  });
});
