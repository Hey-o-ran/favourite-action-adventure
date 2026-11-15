// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WalletContext, type WalletValue } from '../wallet';
import { Slots, STOP_AT_MS } from './Slots';
import { STOPS, STRIP, type SlotSymbol } from './slotsRules';

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();
const wallet = (balance: number): WalletValue => ({
  balance,
  wager,
  settle,
  flush: async () => {},
  refresh: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});

const setup = (balance = 1000) => {
  render(
    <WalletContext.Provider value={wallet(balance)}>
      <Slots />
    </WalletContext.Provider>,
  );
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
};

/** Makes the three reels stop on these symbols (the first position in the ring that holds each one). */
const reelsStopOn = (...symbols: SlotSymbol[]) => {
  const random = vi.spyOn(Math, 'random');
  for (const symbol of symbols) random.mockReturnValueOnce((STRIP.indexOf(symbol) + 0.5) / STOPS);
};

const reel = (n: number) => screen.getByRole('img', { name: new RegExp(`^Reel ${n}:`) });
const spinButton = () => screen.getByRole('button', { name: /spin|spinning/i });
const result = () => document.querySelector('.result');
const pass = (ms: number) => reactAct(() => vi.advanceTimersByTime(ms));
const finish = () => pass(STOP_AT_MS[2]);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  wager.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the slot machine', () => {
  it('has three reels showing three symbols each, with the middle one on the line', () => {
    setup();
    for (let n = 1; n <= 3; n++) {
      expect(reel(n)).toHaveAccessibleName(/above, .* on the line, .* below$/);
      expect(reel(n).querySelectorAll('.sl-cell')).toHaveLength(3);
      expect(reel(n).querySelectorAll('.sl-cell.line')).toHaveLength(1);
    }
  });

  it('shows what each combination pays', () => {
    setup();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /three seven/i })).toHaveTextContent('100×');
    expect(within(table).getByRole('row', { name: /three cherry/i })).toHaveTextContent('5×');
    expect(within(table).getByRole('row', { name: /any two cherries/i })).toHaveTextContent('3×');
  });
});

describe('spinning', () => {
  it('takes the bet, switches off the controls, and does not give the result away early', async () => {
    reelsStopOn('seven', 'seven', 'seven');
    const user = setup();
    await user.click(spinButton());
    expect(wager).toHaveBeenCalledWith(10);
    expect(wager).toHaveBeenCalledTimes(1);
    for (let n = 1; n <= 3; n++) expect(reel(n)).toHaveAccessibleName(`Reel ${n}: spinning`);
    expect(spinButton()).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: /bet/i })).toBeDisabled();
    expect(result()).toHaveTextContent(/spinning/i);
    expect(settle).not.toHaveBeenCalled();
  });

  it('stops the reels one after another, left to right', async () => {
    reelsStopOn('cherry', 'lemon', 'bell');
    const user = setup();
    await user.click(spinButton());

    await pass(STOP_AT_MS[0]);
    expect(reel(1)).toHaveAccessibleName(/cherry on the line/);
    expect(reel(2)).toHaveAccessibleName('Reel 2: spinning');
    expect(reel(3)).toHaveAccessibleName('Reel 3: spinning');
    expect(settle).not.toHaveBeenCalled();

    await pass(STOP_AT_MS[1] - STOP_AT_MS[0]);
    expect(reel(2)).toHaveAccessibleName(/lemon on the line/);
    expect(reel(3)).toHaveAccessibleName('Reel 3: spinning');
    expect(settle).not.toHaveBeenCalled();

    await pass(STOP_AT_MS[2] - STOP_AT_MS[1]);
    expect(reel(3)).toHaveAccessibleName(/bell on the line/);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('pays the jackpot for three sevens', async () => {
    reelsStopOn('seven', 'seven', 'seven');
    const user = setup();
    await user.click(spinButton());
    await finish();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(1000);
    expect(result()).toHaveTextContent('Three seven! Pays 100× your bet: +990 coins');
    expect(reel(1).querySelector('.sl-cell.line')).toHaveClass('win');
  });

  it('pays for three of a kind of a cheaper symbol at its own rate', async () => {
    reelsStopOn('grape', 'grape', 'grape');
    const user = setup();
    await user.click(spinButton());
    await finish();
    expect(settle).toHaveBeenCalledWith(100);
    expect(result()).toHaveTextContent('Three grapes! Pays 10× your bet: +90 coins');
  });

  it('pays for exactly two cherries, wherever they are', async () => {
    reelsStopOn('cherry', 'lemon', 'cherry');
    const user = setup();
    await user.click(spinButton());
    await finish();
    expect(settle).toHaveBeenCalledWith(30);
    expect(result()).toHaveTextContent('Two cherries! Pays 3× your bet: +20 coins');
  });

  it('settles for 0 when nothing lines up, and does not mark a win', async () => {
    reelsStopOn('cherry', 'lemon', 'bell');
    const user = setup();
    await user.click(spinButton());
    await finish();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
    expect(result()).toHaveTextContent('No win. -10 coins');
    expect(document.querySelector('.sl-cell.win')).toBeNull();
  });

  it('bets what you chose', async () => {
    reelsStopOn('lemon', 'lemon', 'lemon');
    const user = setup();
    await user.click(screen.getByRole('button', { name: '50' }));
    await user.click(screen.getByRole('button', { name: /^spin · 50 coins/i }));
    expect(wager).toHaveBeenCalledWith(50);
    await finish();
    expect(settle).toHaveBeenCalledWith(300); // three lemons pay 6×
    expect(result()).toHaveTextContent('+250 coins');
  });

  it('lets you spin again once the reels have stopped', async () => {
    reelsStopOn('cherry', 'lemon', 'bell', 'seven', 'seven', 'seven');
    const user = setup();
    await user.click(spinButton());
    await finish();
    await user.click(spinButton());
    await finish();
    expect(wager).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenNthCalledWith(1, 0);
    expect(settle).toHaveBeenNthCalledWith(2, 1000);
  });

  it('ignores a second press while the reels are turning, so it only bets once', async () => {
    reelsStopOn('seven', 'seven', 'seven');
    const user = setup();
    await user.dblClick(spinButton());
    await finish();
    expect(wager).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('does not spin when the bet cannot be taken', async () => {
    wager.mockReturnValue(false);
    const user = setup();
    await user.click(spinButton());
    expect(result()).not.toHaveTextContent(/spinning/i);
    expect(settle).not.toHaveBeenCalled();
  });

  it('cannot spin for more than you have', () => {
    setup(5);
    expect(spinButton()).toBeDisabled();
  });
});
