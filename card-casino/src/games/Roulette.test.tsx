// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WalletContext, type WalletValue } from '../wallet';
import { Roulette, SPIN_MS } from './Roulette';

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

/** Makes the ball land on `pocket`. The wheel picks a pocket from Math.random(). */
const ballLandsOn = (pocket: number) => vi.spyOn(Math, 'random').mockReturnValue((pocket + 0.5) / 37);

let view: ReturnType<typeof render>;
const table = (balance: number) => (
  <WalletContext.Provider value={wallet(balance)}>
    <Roulette />
  </WalletContext.Provider>
);
const setup = (balance = 1000) => {
  view = render(table(balance));
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
};
/** Changes the player's balance, as the wallet would after a bet is taken or a payout lands. */
const setBalance = (balance: number) => view.rerender(table(balance));

const spot = (name: RegExp) => screen.getByRole('button', { name });
const pickChip = (user: ReturnType<typeof userEvent.setup>, value: number) =>
  user.click(within(screen.getByRole('group', { name: /chip value/i })).getByRole('button', { name: String(value) }));
const onTable = () => screen.getByText(/on the table/i).textContent;
const spinNow = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /^spin/i }));
const finishSpin = () => reactAct(() => vi.advanceTimersByTime(SPIN_MS));
const result = () => document.querySelector('.result');

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

describe('the roulette table', () => {
  it('has all 37 numbers, and the dozens, columns and even money bets', () => {
    setup();
    for (let n = 0; n <= 36; n++) expect(spot(new RegExp(`^Number ${n}, `))).toBeInTheDocument();
    expect(spot(/^Dozen 1 to 12/)).toBeInTheDocument();
    expect(spot(/^Dozen 25 to 36/)).toBeInTheDocument();
    expect(spot(/^Column 1:/)).toBeInTheDocument();
    for (const name of [/^Red,/, /^Black,/, /^Odd,/, /^Even,/, /^1–18,/, /^19–36,/]) expect(spot(name)).toBeInTheDocument();
  });

  it('colours the numbers like the real table', () => {
    setup();
    expect(spot(/^Number 0, green/)).toBeInTheDocument();
    expect(spot(/^Number 1, red/)).toBeInTheDocument();
    expect(spot(/^Number 2, black/)).toBeInTheDocument();
  });

  it('offers a split, street, corner and six line where the real table does', () => {
    setup();
    expect(spot(/^Split 5 and 8$/)).toBeInTheDocument();
    expect(spot(/^Split 5 and 6$/)).toBeInTheDocument();
    expect(spot(/^Split 0 and 2$/)).toBeInTheDocument();
    expect(spot(/^Street 7, 8, 9$/)).toBeInTheDocument();
    expect(spot(/^Corner 4, 5, 7, 8$/)).toBeInTheDocument();
    expect(spot(/^Six line 1 to 6$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Split 3 and 4$/ })).not.toBeInTheDocument();
  });
});

describe('putting chips down', () => {
  it('puts the chosen chip on a spot, and shows it there and in the total', async () => {
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    expect(spot(/^Number 17, black, 10 coins on it$/)).toBeInTheDocument();
    expect(onTable()).toBe('On the table: 10 coins');
  });

  it('stacks chips, and uses whichever chip is chosen', async () => {
    const user = setup();
    await pickChip(user, 25);
    await user.click(spot(/^Number 17, black$/));
    await user.click(spot(/^Number 17, black/));
    await pickChip(user, 1);
    await user.click(spot(/^Red,/));
    expect(spot(/^Number 17, black, 50 coins on it$/)).toBeInTheDocument();
    expect(spot(/^Red, pays 1 to 1, 1 coins on it$/)).toBeInTheDocument();
    expect(onTable()).toBe('On the table: 51 coins');
  });

  it('puts chips on a split, a corner and a street without touching the numbers in them', async () => {
    const user = setup();
    await user.click(spot(/^Split 5 and 8$/));
    await user.click(spot(/^Corner 4, 5, 7, 8$/));
    await user.click(spot(/^Street 7, 8, 9$/));
    expect(spot(/^Split 5 and 8, 10 coins on it$/)).toBeInTheDocument();
    expect(spot(/^Number 5, red$/)).toBeInTheDocument(); // no chip on the number itself
    expect(onTable()).toBe('On the table: 30 coins');
  });

  it('takes chips back one at a time with Undo, and all at once with Clear', async () => {
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await pickChip(user, 5);
    await user.click(spot(/^Number 17, black/));
    await user.click(spot(/^Red,/));
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(onTable()).toBe('On the table: 15 coins');
    await user.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(spot(/^Number 17, black, 10 coins on it$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onTable()).toBe('On the table: 0 coins');
    expect(screen.getByRole('button', { name: /^undo$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^clear$/i })).toBeDisabled();
  });

  it('does not let you put down more than you have', async () => {
    const user = setup(25);
    await user.click(spot(/^Number 1, red$/));
    await user.click(spot(/^Number 2, black$/));
    await user.click(spot(/^Number 3, red$/)); // only 5 left, and the chip is 10
    expect(onTable()).toBe('On the table: 20 coins');
    await pickChip(user, 5);
    await user.click(spot(/^Number 3, red$/));
    expect(onTable()).toBe('On the table: 25 coins');
    await user.click(spot(/^Number 4, black$/));
    expect(onTable()).toBe('On the table: 25 coins');
  });

  it('cannot spin with nothing on the table', () => {
    setup();
    expect(screen.getByRole('button', { name: /^spin/i })).toBeDisabled();
  });
});

describe('spinning', () => {
  it('takes the whole bet up front, stops more bets, then pays out when the wheel stops', async () => {
    ballLandsOn(17);
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await user.click(spot(/^Red,/));
    await spinNow(user);

    expect(wager).toHaveBeenCalledTimes(1);
    expect(wager).toHaveBeenCalledWith(20);
    expect(result()).toHaveTextContent(/no more bets/i);
    expect(spot(/^Number 5, red$/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /spinning/i })).toBeDisabled();
    expect(settle).not.toHaveBeenCalled(); // the result is not given away early

    await finishSpin();
    // 17 is black: the single number pays 360 back and red loses.
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(360);
    expect(result()).toHaveTextContent('The ball landed on 17 black');
    expect(result()).toHaveTextContent('+340 coins');
  });

  it('settles for 0 when every bet loses', async () => {
    ballLandsOn(4);
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await spinNow(user);
    await finishSpin();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
    expect(result()).toHaveTextContent('-10 coins');
  });

  it('loses every half-table bet on 0', async () => {
    ballLandsOn(0);
    const user = setup();
    for (const name of [/^Red,/, /^Black,/, /^Odd,/, /^Even,/, /^1–18,/, /^19–36,/]) await user.click(spot(name));
    await spinNow(user);
    await finishSpin();
    expect(settle).toHaveBeenCalledWith(0);
    expect(result()).toHaveTextContent('The ball landed on 0 green');
  });

  it('says so when you only get your bet back, and when you get back part of it', async () => {
    ballLandsOn(2); // black
    const user = setup();
    await user.click(spot(/^Red,/));
    await user.click(spot(/^Black,/));
    await spinNow(user);
    await finishSpin();
    expect(settle).toHaveBeenLastCalledWith(20);
    expect(result()).toHaveTextContent(/got your bet back/i);

    await user.click(spot(/^Red,/));
    await user.click(spot(/^Black,/));
    await user.click(spot(/^Number 17, black$/));
    await spinNow(user);
    await finishSpin();
    expect(settle).toHaveBeenLastCalledWith(20);
    expect(result()).toHaveTextContent('You got back 20 of 30');
    expect(result()).toHaveTextContent('-10 coins');
  });

  it('pays a split, a street and a column at their own odds', async () => {
    ballLandsOn(8);
    const user = setup();
    await user.click(spot(/^Split 5 and 8$/)); // 17 to 1: 180
    await user.click(spot(/^Street 7, 8, 9$/)); // 11 to 1: 120
    await user.click(spot(/^Column 2:/)); // 2 to 1: 30
    await spinNow(user);
    await finishSpin();
    expect(settle).toHaveBeenCalledWith(180 + 120 + 30);
  });

  it('clears the table after a spin, and Rebet puts the same bets back', async () => {
    ballLandsOn(4);
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await user.click(spot(/^Red,/));
    await spinNow(user);
    await finishSpin();
    expect(onTable()).toBe('On the table: 0 coins');

    await user.click(screen.getByRole('button', { name: /^rebet \(20\)/i }));
    expect(onTable()).toBe('On the table: 20 coins');
    expect(spot(/^Number 17, black, 10 coins on it$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rebet/i })).toBeDisabled(); // already on the table
  });

  it('will not rebet more than you have', async () => {
    ballLandsOn(4);
    const user = setup(30);
    await user.click(spot(/^Number 17, black$/));
    await user.click(spot(/^Red,/));
    await user.click(spot(/^Number 1, red$/));
    await spinNow(user);
    await finishSpin();
    expect(screen.getByRole('button', { name: /^rebet \(30\)/i })).toBeEnabled();
    setBalance(20); // the spin cost 30 and nothing came back
    expect(screen.getByRole('button', { name: /^rebet \(30\)/i })).toBeDisabled();
  });

  it('keeps a history of results, newest first', async () => {
    const user = setup();
    const random = ballLandsOn(4);
    for (const pocket of [4, 17, 0]) {
      random.mockReturnValue((pocket + 0.5) / 37);
      await user.click(spot(/^Red,/));
      await spinNow(user);
      await finishSpin();
    }
    const history = within(screen.getByRole('list', { name: /recent results/i })).getAllByRole('listitem');
    expect(history.map((li) => li.textContent)).toEqual(['0', '17', '4']);
    expect(history[0]).toHaveClass('green');
    expect(history[1]).toHaveClass('black');
    expect(history[2]).toHaveClass('black');
  });

  it('does not spin if the bet cannot be taken', async () => {
    wager.mockReturnValue(false);
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await spinNow(user);
    expect(result()).not.toHaveTextContent(/no more bets/i);
    expect(settle).not.toHaveBeenCalled();
    expect(onTable()).toBe('On the table: 10 coins'); // still there to change
  });

  it('settles only once even if you press Spin again during the spin', async () => {
    ballLandsOn(17);
    const user = setup();
    await user.click(spot(/^Number 17, black$/));
    await user.dblClick(screen.getByRole('button', { name: /^spin/i }));
    await finishSpin();
    expect(wager).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
