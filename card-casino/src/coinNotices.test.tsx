// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { CoinNoticesProvider } from './coinNotices';
import { POLL_MS } from './abuseEvents';
import { AnnouncementBar } from './components/AnnouncementBar';
import { SessionContext, type Session } from './session';
import { WalletProvider, useWallet } from './wallet';
import * as api from './api';
import { ApiError, type CoinNotice } from './api';
import { fakeBalanceServer } from './testBalanceServer';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return {
    ...actual,
    listNotices: vi.fn(),
    dismissNotice: vi.fn(),
    getBalance: vi.fn(),
    saveBalance: vi.fn(),
  };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', isAdmin: false },
};
const logout = vi.fn();

const notice = (over: Partial<CoinNotice> = {}): CoinNotice => ({
  noticeId: 'n1',
  amount: 250,
  senderDisplayName: 'Head of Illunnonati',
  createdAt: '2026-11-14T10:00:00.000Z',
  ...over,
});

function Balance() {
  const { balance } = useWallet();
  return <p data-testid="balance">{balance}</p>;
}

const tree = () => (
  <SessionContext.Provider value={{ session, logout }}>
    <WalletProvider>
      <CoinNoticesProvider>
        <AnnouncementBar />
        <Balance />
      </CoinNoticesProvider>
    </WalletProvider>
  </SessionContext.Provider>
);

async function start(list: CoinNotice[] = []) {
  vi.mocked(api.listNotices).mockResolvedValue({ notices: list });
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

let server = fakeBalanceServer();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  server = fakeBalanceServer();
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
  vi.mocked(api.dismissNotice).mockResolvedValue(undefined as never);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('coin messages', () => {
  it('tells the player coins were sent, and by whom', async () => {
    await start([notice()]);
    expect(screen.getByText(/250 coins have been sent to you by Head of Illunnonati/i)).toBeInTheDocument();
    expect(api.listNotices).toHaveBeenCalledWith('tok');
  });

  it('tells the player coins were removed, and by whom', async () => {
    await start([notice({ amount: -200 })]);
    expect(screen.getByText(/200 coins have been removed from you by Head of Illunnonati/i)).toBeInTheDocument();
  });

  it('writes big numbers with commas', async () => {
    await start([notice({ amount: 1_500_000 })]);
    expect(screen.getByText(/1,500,000 coins have been sent to you/i)).toBeInTheDocument();
  });

  it('shows nothing when there are no messages', async () => {
    await start([]);
    expect(screen.queryByText(/have been (sent|removed)/i)).not.toBeInTheDocument();
  });

  it('shows the new balance straight away, not the old one', async () => {
    await start([]);
    expect(screen.getByTestId('balance')).toHaveTextContent('1000');
    // The admin sends 250 coins: the server balance moves on, and the message arrives with the next poll.
    server.state.balance = 1250;
    server.state.version = 1;
    vi.mocked(api.listNotices).mockResolvedValue({ notices: [notice()] });
    await poll();
    expect(await screen.findByText(/250 coins have been sent/i)).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByTestId('balance')).toHaveTextContent('1250'));
  });

  it('only refreshes the balance once per message, however often it polls', async () => {
    await start([notice()]);
    await vi.waitFor(() => expect(api.getBalance).toHaveBeenCalledTimes(2));
    await poll();
    await poll();
    expect(api.getBalance).toHaveBeenCalledTimes(2);
  });

  it('picks up a new message on a later poll', async () => {
    await start([]);
    vi.mocked(api.listNotices).mockResolvedValue({ notices: [notice({ noticeId: 'n2', amount: 40 })] });
    await poll();
    expect(await screen.findByText(/40 coins have been sent to you/i)).toBeInTheDocument();
  });

  it('shows several messages, oldest first', async () => {
    await start([notice({ noticeId: 'a', amount: 100 }), notice({ noticeId: 'b', amount: -30 })]);
    const texts = screen.getAllByRole('status').map((el) => el.textContent ?? '');
    expect(texts.findIndex((t) => /100 coins have been sent/.test(t))).toBeLessThan(
      texts.findIndex((t) => /30 coins have been removed/.test(t)),
    );
  });
});

describe('dismissing', () => {
  it('removes the message and tells the server', async () => {
    await start([notice()]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(api.dismissNotice).toHaveBeenCalledWith('tok', 'n1');
    expect(screen.queryByText(/have been sent to you/i)).not.toBeInTheDocument();
  });

  it('does not bring a dismissed message back while the server still lists it', async () => {
    await start([notice()]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    await poll();
    expect(screen.queryByText(/have been sent to you/i)).not.toBeInTheDocument();
  });
});

describe('when things go wrong', () => {
  it('logs out when the session is rejected', async () => {
    vi.mocked(api.listNotices).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    render(tree());
    await screen.findByTestId('balance');
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('stays quiet when the messages cannot be loaded, and tries again later', async () => {
    vi.mocked(api.listNotices).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    await start();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.mocked(api.listNotices).mockResolvedValue({ notices: [notice()] });
    await poll();
    expect(await screen.findByText(/250 coins have been sent/i)).toBeInTheDocument();
  });

  it('still removes the message from the screen if telling the server fails', async () => {
    vi.mocked(api.dismissNotice).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    await start([notice()]);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/have been sent to you/i)).not.toBeInTheDocument();
  });
});
