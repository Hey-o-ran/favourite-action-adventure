// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AdminCoins } from './AdminCoins';
import { SessionContext, type Session } from '../session';
import * as api from '../api';
import { ApiError } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, searchUsers: vi.fn(), giveCoins: vi.fn() };
});

const session: Session = {
  idToken: 'admin-token',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true },
};
const logout = vi.fn();

const renderIt = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <AdminCoins />
    </SessionContext.Provider>,
  );

const ada = { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', balance: 750 };
const adam = { userId: 'u2', email: 'adam@example.com', displayName: 'Adam', balance: 1000 };

async function searchFor(term: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/find a player/i), term);
  await user.click(screen.getByRole('button', { name: /^search$/i }));
  return user;
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe('finding a player', () => {
  it('shows name, email and balance of each match', async () => {
    vi.mocked(api.searchUsers).mockResolvedValue({ users: [ada, adam], truncated: false });
    renderIt();
    await searchFor('ad');
    expect(api.searchUsers).toHaveBeenCalledWith('admin-token', 'ad');
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText(/750 coins/i)).toBeInTheDocument();
    expect(screen.getByText('Adam')).toBeInTheDocument();
  });

  it('does not search for fewer than 2 characters', async () => {
    renderIt();
    await searchFor('a');
    expect(api.searchUsers).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
  });

  it('says so when nobody matches', async () => {
    vi.mocked(api.searchUsers).mockResolvedValue({ users: [], truncated: false });
    renderIt();
    await searchFor('zz');
    expect(await screen.findByText(/no players found/i)).toBeInTheDocument();
  });

  it('asks for a more specific search when there are more results than shown', async () => {
    vi.mocked(api.searchUsers).mockResolvedValue({ users: [ada], truncated: true });
    renderIt();
    await searchFor('ad');
    expect(await screen.findByText(/more players match/i)).toBeInTheDocument();
  });

  it('shows an error when the search fails', async () => {
    vi.mocked(api.searchUsers).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    renderIt();
    await searchFor('ad');
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not search/i);
  });

  it('logs out when the session is rejected', async () => {
    vi.mocked(api.searchUsers).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    renderIt();
    await searchFor('ad');
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });
});

describe('giving and taking coins', () => {
  async function pick(name: string) {
    vi.mocked(api.searchUsers).mockResolvedValue({ users: [ada, adam], truncated: false });
    renderIt();
    const user = await searchFor('ad');
    await user.click(await screen.findByRole('button', { name: new RegExp(`^choose ${name}$`, 'i') }));
    return user;
  }

  it('gives coins and shows the new balance', async () => {
    vi.mocked(api.giveCoins).mockResolvedValue({ userId: 'u1', amount: 250, balance: 1000, version: 5 });
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '250');
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    expect(api.giveCoins).toHaveBeenCalledWith('admin-token', 'u1', 250);
    expect(await screen.findByRole('status')).toHaveTextContent(/gave 250 coins to ada.*1,000 coins/i);
    expect(screen.getByRole('row', { name: /ada@example\.com/i })).toHaveTextContent(/1,000 coins/i);
  });

  it('takes coins away by sending a negative amount', async () => {
    vi.mocked(api.giveCoins).mockResolvedValue({ userId: 'u1', amount: -200, balance: 550, version: 5 });
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '200');
    await user.click(screen.getByRole('button', { name: /^take coins$/i }));
    expect(api.giveCoins).toHaveBeenCalledWith('admin-token', 'u1', -200);
    expect(await screen.findByRole('status')).toHaveTextContent(/took 200 coins from ada.*550 coins/i);
  });

  it.each(['0', '12.5', '-5', 'lots', ''])('rejects the amount "%s" without calling the server', async (raw) => {
    const user = await pick('Ada');
    if (raw) await user.type(screen.getByLabelText(/amount/i), raw);
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    expect(api.giveCoins).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
  });

  it('explains when the balance would go out of range, with the current balance', async () => {
    vi.mocked(api.giveCoins).mockRejectedValue(
      new ApiError(409, 'BALANCE_OUT_OF_RANGE', 'x', undefined, { balance: 750 }),
    );
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '800');
    await user.click(screen.getByRole('button', { name: /^take coins$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/below 0.*750 coins/i);
  });

  it('explains when the account is not active', async () => {
    vi.mocked(api.giveCoins).mockRejectedValue(new ApiError(409, 'ACCOUNT_NOT_ACTIVE', 'x'));
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '10');
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not active/i);
  });

  it('shows a generic error when it fails, and keeps the player chosen', async () => {
    vi.mocked(api.giveCoins).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'x'));
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '10');
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not change/i);
    expect(screen.getByLabelText(/amount/i)).toHaveValue('10');
  });

  it('logs out when the session is rejected', async () => {
    vi.mocked(api.giveCoins).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '10');
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('switches to another player and clears the old message', async () => {
    vi.mocked(api.giveCoins).mockResolvedValue({ userId: 'u1', amount: 10, balance: 760, version: 5 });
    const user = await pick('Ada');
    await user.type(screen.getByLabelText(/amount/i), '10');
    await user.click(screen.getByRole('button', { name: /^give coins$/i }));
    await screen.findByRole('status');
    await user.click(screen.getByRole('button', { name: /choose adam/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/giving coins to adam/i)).toBeInTheDocument();
  });
});
