// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Card } from '../cards';
import { newDeck, shuffle } from '../cards';
import { WalletContext, type WalletValue } from '../wallet';
import { DEAL_LOCK_MS } from '../useDealLock';
import { Gin } from './Gin';
import { cards } from './ginTestUtils';

// The deck is whatever the test says, so every hand is known.
vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));

/**
 * The bot deals (Math.random is 0.9), so you get the even cards and the bot the odd ones, then comes the
 * up card, then the stock.
 *
 * You: a set of 7s, 2-3-4 and 8-9-10 of spades, and a loose king. The up card is the 5 of spades, so taking it
 * and throwing the king is gin. The bot holds 98 points of unmatched face cards, so a gin ends the whole match.
 */
const YOU = cards('7h 7d 7c 2s 3s 4s 8s 9s Ts Kh');
const BOT = cards('Kd Kc Qd Qs Jc Jh Td Th 9c 9d');
const UP = cards('5s');
const used = [...YOU, ...BOT, ...UP];
const REST = newDeck().filter((c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit));
const DECK: Card[] = [...YOU.flatMap((c, i) => [c, BOT[i]]), ...UP, ...REST];

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();
const wallet = (): WalletValue => ({
  balance: 1000,
  wager,
  settle,
  flush: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});

const setup = () => {
  vi.mocked(shuffle).mockReturnValue(DECK);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(
    <WalletContext.Provider value={wallet()}>
      <Gin />
    </WalletContext.Provider>,
  );
  return user;
};

const button = (name: RegExp) => screen.getByRole('button', { name });
const result = () => document.querySelector('.result');
const advance = (ms: number) => reactAct(() => vi.advanceTimersByTime(ms));
const waitForLock = () => advance(DEAL_LOCK_MS);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0.9);
  wager.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Gin Rummy table', () => {
  it('takes the bet and deals 10 cards each, with the first card turned up and you first to act', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(wager).toHaveBeenCalledWith(50);
    expect(screen.getByText(/you · 10 cards/i)).toBeInTheDocument();
    expect(screen.getByText(/bot · 10 cards/i)).toBeInTheDocument();
    expect(screen.getByText(/hand 1/i)).toHaveTextContent(/bot deals/i);
    expect(button(/take the 5♠/i)).toBeInTheDocument();
    expect(button(/^pass$/i)).toBeInTheDocument();
  });

  it('groups your cards into melds and shows what is left over', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(screen.getAllByLabelText('Meld')).toHaveLength(3); // the set of 7s and the runs 2-3-4 and 8-9-10
    expect(screen.getByText(/10 loose points/i)).toBeInTheDocument();
  });

  it('plays to gin and wins the match, paying the bet back twice over', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/take the 5♠/i));

    // You can't throw back the card you just took, and you must pick a card before you can discard.
    expect(button(/pick a card to discard/i)).toBeDisabled();
    expect(button(/^knock$/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: '5 of spades' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'K of hearts' }));
    expect(button(/discard the k♥/i)).toBeEnabled();
    await user.click(button(/gin!/i));

    expect(result()).toHaveTextContent(/you went gin/i);
    expect(result()).toHaveTextContent(/you win the match/i);
    expect(result()).toHaveTextContent(/\+50 coins/);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(100);
    expect(document.querySelector('.final-score')).toHaveTextContent(/you 243/i);
    expect(button(/deal again/i)).toBeInTheDocument();
  });

  it('does not let you knock when you would have too many points left', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/take the 5♠/i));
    // Throwing a 7 breaks the set: two loose 7s and the king is 24 points, too many to knock.
    await user.click(screen.getByRole('button', { name: '7 of hearts' }));
    expect(button(/knock \(\d+ left\)/i)).toBeDisabled();
  });

  it('lets the bot play when you pass, and then makes you draw from the stock', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await waitForLock();
    await user.click(button(/^pass$/i));
    expect(result()).toHaveTextContent(/bot is thinking/i);
    await advance(1000); // the bot passes too: its cards don't fit the 5♠
    expect(result()).toHaveTextContent(/nobody wanted it/i);
    expect(button(/draw from the stock/i)).toBeEnabled();
    expect(button(/take the 5♠/i)).toBeDisabled(); // not allowed after both pass
  });

  it('keeps the buttons switched off for a moment after a deal, so a double-click cannot act for you', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(button(/take the 5♠/i)).toBeDisabled();
    expect(button(/^pass$/i)).toBeDisabled();
    await waitForLock();
    expect(button(/take the 5♠/i)).toBeEnabled();
  });

  it('ignores a second click straight after Deal', async () => {
    const user = setup();
    await user.dblClick(button(/^deal$/i));
    expect(screen.getByText(/you · 10 cards/i)).toBeInTheDocument(); // nothing was taken
    expect(button(/^pass$/i)).toBeInTheDocument();
    expect(wager).toHaveBeenCalledTimes(1);
  });

  it('asks before you forfeit, and the stake is lost once you do', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    await user.click(button(/forfeit match/i));
    expect(screen.getByText(/lose your 50 coins/i)).toBeInTheDocument();

    await user.click(button(/keep playing/i));
    expect(settle).not.toHaveBeenCalled();
    expect(button(/forfeit match/i)).toBeInTheDocument();

    await user.click(button(/forfeit match/i));
    await user.click(within(screen.getByRole('group', { name: /forfeit the match/i })).getByRole('button', { name: /yes, forfeit/i }));
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
    expect(result()).toHaveTextContent(/you forfeited the match/i);
    expect(result()).toHaveTextContent(/-50 coins/);
    expect(button(/deal again/i)).toBeInTheDocument();
  });

  it('does not start a match you cannot pay for', async () => {
    wager.mockReturnValue(false);
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(screen.queryByText(/you · 10 cards/i)).not.toBeInTheDocument();
    expect(settle).not.toHaveBeenCalled();
  });
});
