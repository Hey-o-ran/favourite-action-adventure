// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Card, Suit } from '../cards';
import { shuffle } from '../cards';
import { WalletContext, type WalletValue } from '../wallet';
import { DEAL_LOCK_MS } from '../useDealLock';
import { RedDog } from './RedDog';
import { HigherLower } from './HigherLower';

vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));

const SUIT: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
const RANK: Record<string, number> = { A: 1, T: 10, J: 11, Q: 12, K: 13 };
const cards = (text: string): Card[] => text.trim().split(/\s+/).map((t) => ({ rank: RANK[t[0]] ?? Number(t[0]), suit: SUIT[t[1]] }));

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

const setup = (ui: JSX.Element, deck: Card[]) => {
  vi.mocked(shuffle).mockReturnValue(deck);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(<WalletContext.Provider value={wallet()}>{ui}</WalletContext.Provider>);
  return user;
};
const button = (name: RegExp) => screen.getByRole('button', { name });
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

describe('Red Dog: a double-click on Deal must not deal the third card for you', () => {
  // 2 and 8 leave five cards between them, so the hand waits for a decision.
  const deck = cards('2s 8h 5d  3c 4c 6c');

  it('keeps the buttons switched off for a moment, then enables them', async () => {
    const user = setup(<RedDog />, deck);
    await user.click(button(/^deal$/i));
    for (const name of [/deal third card/i, /raise \+5/i, /raise \+10/i]) expect(button(name)).toBeDisabled();
    await waitForLock();
    expect(button(/deal third card/i)).toBeEnabled();
  });

  it('ignores a second click straight after the deal, and takes it once the lock is over', async () => {
    const user = setup(<RedDog />, deck);
    await user.dblClick(button(/^deal$/i));
    expect(button(/deal third card/i)).toBeInTheDocument();
    expect(settle).not.toHaveBeenCalled();

    await waitForLock();
    await user.click(button(/deal third card/i));
    expect(settle).toHaveBeenCalledTimes(1);
  });
});

describe('Higher or Lower: a double-click on Start must not make a guess for you', () => {
  const deck = cards('5s 9h 2c 3c 4c');

  it('keeps the buttons switched off for a moment, then enables them', async () => {
    const user = setup(<HigherLower />, deck);
    await user.click(button(/^start$/i));
    for (const name of [/higher/i, /lower/i, /cash out/i, /jackpot/i]) expect(button(name)).toBeDisabled();
    await waitForLock();
    expect(button(/higher/i)).toBeEnabled();
    expect(button(/jackpot/i)).toBeEnabled();
  });

  it('ignores a second click straight after the start, and takes it once the lock is over', async () => {
    const user = setup(<HigherLower />, deck);
    await user.dblClick(button(/^start$/i));
    expect(button(/higher/i)).toBeInTheDocument();
    expect(document.querySelector('.result')).toHaveTextContent(/streak 0/i);

    await waitForLock();
    await user.click(button(/higher/i));
    expect(document.querySelector('.result')).not.toHaveTextContent(/streak 0/i);
  });
});
