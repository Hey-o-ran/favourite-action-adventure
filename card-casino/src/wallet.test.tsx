// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WalletProvider, useWallet } from './wallet';
import { SaveStatus } from './components/SaveStatus';
import { SessionContext, type Session } from './session';
import * as api from './api';
import { ApiError } from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, getBalance: vi.fn(), saveBalance: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', isAdmin: false },
};
const logout = vi.fn();
let captured: ReturnType<typeof useWallet> | undefined;

function Probe() {
  const w = useWallet();
  captured = w;
  return (
    <div>
      <p data-testid="balance">{w.balance}</p>
      <button onClick={() => w.wager(100)}>wager 100</button>
      <button onClick={() => w.wager(5000)}>wager 5000</button>
      <button onClick={() => w.settle(250)}>settle 250</button>
      <button onClick={() => void w.flush()}>flush</button>
      <SaveStatus />
    </div>
  );
}

const renderWallet = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <WalletProvider saveDelayMs={20}>
        <Probe />
      </WalletProvider>
    </SessionContext.Provider>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(api.getBalance).mockResolvedValue({ balance: 1000, version: 0 });
  vi.mocked(api.saveBalance).mockImplementation(async (_t, req) => ({ balance: req.balance, version: req.version + 1 }));
});
afterEach(() => cleanup());

describe('loading the balance', () => {
  it('shows the casino with the balance stored on the server', async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 750, version: 4 });
    renderWallet();
    expect(screen.getByText(/loading your balance/i)).toBeInTheDocument();
    expect(await screen.findByTestId('balance')).toHaveTextContent('750');
    expect(api.getBalance).toHaveBeenCalledWith('tok');
  });

  it('offers a retry when the balance cannot be loaded', async () => {
    vi.mocked(api.getBalance).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    const user = userEvent.setup();
    renderWallet();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your balance/i);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('balance')).toHaveTextContent('1000');
  });

  it('logs out when the session is rejected', async () => {
    vi.mocked(api.getBalance).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    renderWallet();
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('removes the old shared browser balance', async () => {
    window.localStorage.setItem('card-casino.balance', '42');
    renderWallet();
    await screen.findByTestId('balance');
    expect(window.localStorage.getItem('card-casino.balance')).toBeNull();
  });
});

describe('using coins', () => {
  it('updates instantly and saves the new balance to the server shortly after', async () => {
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'wager 100' }));
    expect(screen.getByTestId('balance')).toHaveTextContent('900');
    await vi.waitFor(() => expect(api.saveBalance).toHaveBeenCalledWith('tok', { balance: 900, version: 0 }, undefined));
  });

  it('refuses a wager the player cannot afford', async () => {
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'wager 5000' }));
    expect(screen.getByTestId('balance')).toHaveTextContent('1000');
    expect(api.saveBalance).not.toHaveBeenCalled();
  });

  it('credits a payout', async () => {
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'settle 250' }));
    expect(screen.getByTestId('balance')).toHaveTextContent('1250');
  });

  it('has no way to top itself up at zero', async () => {
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 0, version: 2 });
    renderWallet();
    expect(await screen.findByTestId('balance')).toHaveTextContent('0');
    expect('refill' in (captured ?? {})).toBe(false);
  });

  it('flush saves straight away', async () => {
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'wager 100' }));
    await user.click(screen.getByRole('button', { name: 'flush' }));
    expect(api.saveBalance).toHaveBeenCalledTimes(1);
  });
});

describe('save status', () => {
  it('shows nothing while everything is saved', async () => {
    renderWallet();
    await screen.findByTestId('balance');
    expect(screen.queryByText(/not saved yet/i)).not.toBeInTheDocument();
  });

  it('says "Not saved yet" while saves are failing, and keeps playing', async () => {
    vi.mocked(api.saveBalance).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'wager 100' }));
    expect(await screen.findByText(/not saved yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('900');
  });

  it('tells the player when the balance was refreshed from another device, and can be dismissed', async () => {
    vi.mocked(api.saveBalance).mockRejectedValue(
      new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 300, version: 7 }),
    );
    const user = userEvent.setup();
    renderWallet();
    await screen.findByTestId('balance');
    await user.click(screen.getByRole('button', { name: 'wager 100' }));
    expect(await screen.findByText(/changed on another device/i)).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('300');
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/changed on another device/i)).not.toBeInTheDocument();
  });
});
