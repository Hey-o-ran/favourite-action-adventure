// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Card, Suit } from '../cards';
import { shuffle } from '../cards';
import { WalletContext, type WalletValue } from '../wallet';
import { Blackjack, DEAL_LOCK_MS } from './Blackjack';

// The deck is whatever the test says, so every hand is known.
vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
/** Cards from text like "Ts 6h". The deal order is player, player, dealer, dealer, then draws. */
const cards = (text: string): Card[] => text.trim().split(/\s+/).map((t) => ({ rank: RANK[t[0]] ?? Number(t[0]), suit: SUIT[t[1]] }));

/**
 * Hand 1: you 10+6 = 16, dealer 10+7 = 17 (no naturals), then plenty of low cards.
 * Hand 2: you 9+7 = 16, dealer 5+6 = 11 (no naturals).
 */
const TWO_PLAIN_HANDS = cards('Ts 6h Td 7c  9s 7h 5d 6c  2c 3c 4c 2d 3d 4d 2h 3h 4h');

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();
const wallet = (): WalletValue => ({
  balance: 1000,
  wager,
  settle,
  flush: async () => {},
  refresh: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});

const setup = (deck: Card[] = TWO_PLAIN_HANDS) => {
  vi.mocked(shuffle).mockReturnValue(deck);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(
    <WalletContext.Provider value={wallet()}>
      <Blackjack />
    </WalletContext.Provider>,
  );
  return user;
};

const button = (name: RegExp) => screen.getByRole('button', { name });
const result = () => document.querySelector('.result');
/** Waits out the short lock after a deal. */
const waitForLock = () => reactAct(() => vi.advanceTimersByTime(DEAL_LOCK_MS));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  wager.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('blackjack: a double-click on Deal must not play your hand for you', () => {
  it('keeps Hit, Stand and Double switched off for a moment after a hand is dealt', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    for (const name of [/^hit$/i, /^stand$/i, /^double$/i]) expect(button(name)).toBeDisabled();

    await waitForLock();
    expect(button(/^hit$/i)).toBeEnabled();
    expect(button(/^stand$/i)).toBeEnabled();
    expect(button(/^double$/i)).toBeEnabled();
  });

  it('ignores a second click that lands on Stand right after Deal again', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^stand$/i)); // hand one ends: 16 loses to 17
    expect(screen.getByText(/dealer wins/i)).toBeInTheDocument();

    await user.click(button(/^deal again$/i));
    // This is the second click of a double-click: Stand is now where Deal again was.
    await user.click(button(/^stand$/i));
    expect(result()).toBeNull(); // the new hand is still waiting for you
    expect(button(/^hit$/i)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: /^you/i })[0]).toHaveTextContent('You · 16');
  });

  it('ignores a second click that lands on Hit, too', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^stand$/i));
    await user.click(button(/^deal again$/i));
    await user.click(button(/^hit$/i));
    expect(screen.getByRole('heading', { name: /^you/i })).toHaveTextContent('You · 16'); // no extra card was drawn
  });

  it('lets you play once the moment has passed', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^stand$/i));
    await user.click(button(/^deal again$/i));
    await waitForLock();
    await user.click(button(/^stand$/i));
    expect(result()).not.toBeNull(); // now it does stand
  });

  it('does not stop a quick hand from ending on its own: a natural pays out at once', async () => {
    // You are dealt an ace and a king: blackjack, so there is nothing to lock.
    const user = setup(cards('As Kh 9d 7c  2c 3c 4c'));
    await user.click(button(/^deal$/i));
    expect(screen.getByText(/blackjack! pays 3 to 2/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^hit$/i })).not.toBeInTheDocument();
    expect(button(/^deal again$/i)).toBeEnabled();
    expect(settle).toHaveBeenCalledTimes(1);
  });
});

describe('blackjack still plays normally after the pause', () => {
  it('hits for a card', async () => {
    // You hold 10 + 6, and the next card is a 2.
    const user = setup(cards('Ts 6h Td 7c  2c 3c 4c'));
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^hit$/i));
    expect(screen.getByRole('heading', { name: /^you/i })).toHaveTextContent('You · 18'); // 10 + 6 + a 2
  });

  it('doubles down: wagers the bet again, takes one card and settles', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^double$/i));
    expect(wager).toHaveBeenCalledTimes(2); // the deal, then the double
    expect(result()).not.toBeNull();
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('settles every hand exactly once', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^stand$/i));
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0); // 16 loses to 17
  });

  it('cleans up its timer if it is removed during the pause', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    cleanup(); // unmount mid-pause
    expect(() => reactAct(() => vi.advanceTimersByTime(DEAL_LOCK_MS))).not.toThrow();
  });
});
