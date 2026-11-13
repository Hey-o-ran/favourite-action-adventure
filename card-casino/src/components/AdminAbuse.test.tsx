// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AdminAbuse } from './AdminAbuse';
import { AbuseEventsProvider } from '../abuseEvents';
import { SessionContext, type Session } from '../session';
import { WalletProvider } from '../wallet';
import * as api from '../api';
import { ApiError, type AbuseEvent } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, startEvent: vi.fn(), listActiveEvents: vi.fn(), claimEvent: vi.fn() };
});

const session: Session = {
  idToken: 'admin-token',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true },
};
const logout = vi.fn();

const started = (over: Partial<AbuseEvent> = {}): AbuseEvent => ({
  eventId: 'e1',
  type: 'FREE_COINS',
  title: 'ADMIN ABUSE',
  message: 'Everyone gets 1,000 coins!',
  amount: 1000,
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  ...over,
});

const renderForm = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <WalletProvider>
        <AbuseEventsProvider>
          <AdminAbuse />
        </AbuseEventsProvider>
      </WalletProvider>
    </SessionContext.Provider>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [] });
  vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'e1', claimed: true });
  window.localStorage.clear();
});
afterEach(() => cleanup());

const startButton = () => screen.getByRole('button', { name: 'Start event' });

describe('admin abuse form', () => {
  it('previews the announcement players will see', async () => {
    renderForm();
    expect(screen.getByRole('heading', { name: /admin abuse/i })).toBeInTheDocument();
    expect(await screen.findByText(/everyone gets 1,000 coins!/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/coins for each player/i)).toHaveValue(1000);
    expect(screen.getByLabelText(/lasts/i)).toHaveValue('10');
  });

  it('updates the preview when the amount or the event changes', async () => {
    const user = userEvent.setup();
    renderForm();
    const amount = screen.getByLabelText(/coins for each player/i);
    await user.clear(amount);
    await user.type(amount, '2500');
    expect(screen.getByText(/everyone gets 2,500 coins!/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /unloseable game/i }));
    expect(screen.getByText(/everybody's next game is unloseable!/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/coins for each player/i)).not.toBeInTheDocument();
  });

  it('does not allow an amount that is not a whole number from 1 to 100,000', async () => {
    const user = userEvent.setup();
    renderForm();
    const amount = screen.getByLabelText(/coins for each player/i);
    for (const bad of ['0', '100001', '12.5', '']) {
      await user.clear(amount);
      if (bad) await user.type(amount, bad);
      expect(await screen.findByRole('alert')).toHaveTextContent(/whole number of coins from 1 to 100,000/i);
      expect(startButton()).toBeDisabled();
    }
    await user.clear(amount);
    await user.type(amount, '100000');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(startButton()).toBeEnabled();
  });

  it('asks you to confirm before telling every player, and can be cancelled', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    expect(screen.getByText(/this tells every player now/i)).toBeInTheDocument();
    expect(api.startEvent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/this tells every player now/i)).not.toBeInTheDocument();
    expect(api.startEvent).not.toHaveBeenCalled();
  });

  it('starts a free coins event with the chosen amount and length, then announces it to the admin too', async () => {
    vi.mocked(api.startEvent).mockResolvedValue({ event: started({ amount: 2500, message: 'Everyone gets 2,500 coins!' }) });
    const user = userEvent.setup();
    renderForm();
    const amount = screen.getByLabelText(/coins for each player/i);
    await user.clear(amount);
    await user.type(amount, '2500');
    await user.selectOptions(screen.getByLabelText(/lasts/i), '30');
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));

    expect(api.startEvent).toHaveBeenCalledWith('admin-token', { type: 'FREE_COINS', amount: 2500, durationMinutes: 30 });
    expect(await screen.findByText(/started for 30 minutes/i)).toBeInTheDocument();
    expect(screen.queryByText(/this tells every player now/i)).not.toBeInTheDocument();
    // It asked the server what is on straight away, so the admin sees it without waiting.
    expect(api.listActiveEvents).toHaveBeenCalledTimes(2);
  });

  it('starts an unloseable event without an amount', async () => {
    vi.mocked(api.startEvent).mockResolvedValue({ event: started({ type: 'UNLOSEABLE', message: "Everybody's next game is unloseable!", amount: undefined }) });
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('radio', { name: /unloseable game/i }));
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));
    expect(api.startEvent).toHaveBeenCalledWith('admin-token', { type: 'UNLOSEABLE', durationMinutes: 10 });
  });

  it('changing the form takes back a confirmation you had not finished', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    await user.selectOptions(screen.getByLabelText(/lasts/i), '60');
    expect(screen.queryByText(/this tells every player now/i)).not.toBeInTheDocument();
    expect(startButton()).toBeInTheDocument();
  });

  it('lists the events that are on', async () => {
    vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [started()] });
    renderForm();
    // The "until HH:MM" part is its own element, so find the list item by that.
    const item = (await screen.findByText(/^until /)).closest('li')!;
    expect(item).toHaveTextContent(/everyone gets 1,000 coins!/i);
  });

  it('says so when no event is on', async () => {
    renderForm();
    expect(await screen.findByText(/no events are on/i)).toBeInTheDocument();
  });

  it('shows what the server did not like', async () => {
    vi.mocked(api.startEvent).mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'bad', { amount: 'Amount cannot exceed 100,000' }));
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Amount cannot exceed 100,000');
    expect(startButton()).toBeInTheDocument(); // back to the form so it can be fixed
  });

  it('says only admins can do this on a 403', async () => {
    vi.mocked(api.startEvent).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Admins only'));
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/only admins can start events/i);
  });

  it('gives a friendly message on any other failure', async () => {
    vi.mocked(api.startEvent).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'down'));
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not start the event/i);
  });

  it('logs you out if your login has expired', async () => {
    vi.mocked(api.startEvent).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Please log in'));
    const user = userEvent.setup();
    renderForm();
    await user.click(startButton());
    await user.click(screen.getByRole('button', { name: 'Yes, start it' }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});
