// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WalletContext, type WalletValue } from '../wallet';
import { HigherLower } from './HigherLower';
import { Klondike } from './Klondike';

// Keep the deck in order (ace of clubs first, then 2, 3...) so the cards that come out are known.
vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: <T,>(items: readonly T[]) => [...items] }));

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();

const wallet = (): WalletValue => ({
  balance: 1000,
  wager,
  settle,
  refill: vi.fn(),
  flush: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});
const renderGame = (game: JSX.Element) => render(<WalletContext.Provider value={wallet()}>{game}</WalletContext.Provider>);

beforeEach(() => {
  vi.resetAllMocks();
  wager.mockReturnValue(true);
});
afterEach(() => cleanup());

/*
 * Every wager must be followed by exactly one settle: with the coins paid back, or 0 for a loss.
 * The admin abuse "unloseable" event relies on that to know when a game has ended.
 */
describe('a lost game tells the wallet it is over', () => {
  it('Higher or Lower: a wrong guess settles for 0', async () => {
    const user = userEvent.setup();
    renderGame(<HigherLower />);
    await user.click(screen.getByRole('button', { name: /start/i })); // the ace (high) is showing
    expect(wager).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /higher/i })); // next card is a 2, so higher is wrong
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
    expect(screen.getByText(/you lost/i)).toBeInTheDocument();
  });

  it('Higher or Lower: a missed jackpot settles for 0', async () => {
    const user = userEvent.setup();
    renderGame(<HigherLower />);
    await user.click(screen.getByRole('button', { name: /start/i }));
    await user.click(screen.getByRole('button', { name: /jackpot/i })); // ace then 2: not the same rank
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
  });

  it('Higher or Lower: a correct guess does not settle yet, and cashing out pays the pot once', async () => {
    const user = userEvent.setup();
    renderGame(<HigherLower />);
    await user.click(screen.getByRole('button', { name: /start/i }));
    await user.click(screen.getByRole('button', { name: /lower/i })); // ace is high, so a 2 is lower: correct
    expect(settle).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /cash out/i }));
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0][0]).toBeGreaterThan(10);
  });

  it('Klondike: giving up settles for 0', async () => {
    const user = userEvent.setup();
    renderGame(<Klondike />);
    await user.click(screen.getByRole('button', { name: /^deal$/i }));
    expect(wager).toHaveBeenCalledTimes(1);
    expect(settle).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /give up/i }));
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
  });
});
