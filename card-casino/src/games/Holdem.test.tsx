// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as reactAct, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WalletProvider, useWallet } from '../wallet';
import { Holdem } from './Holdem';
import { legalActions } from './holdemRules';

// These tests are about the screen, not the bots' strategy (that has its own tests), so the bots here
// just check or call. That keeps every hand going to a showdown and makes the results predictable.
vi.mock('./holdemBots', () => ({
  botAction: (s: Parameters<typeof legalActions>[0]) => (legalActions(s).check ? 'check' : 'call'),
}));

function Balance() {
  return <p data-testid="balance">{useWallet().balance}</p>;
}

function renderTable(balance = 1000) {
  window.localStorage.setItem('card-casino.balance', String(balance));
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(
    <WalletProvider>
      <Balance />
      <Holdem />
    </WalletProvider>,
  );
  return user;
}

const balance = () => Number(screen.getByTestId('balance').textContent);
const faceDown = () => screen.queryAllByLabelText('Face-down card').length;
/** Lets the bots take their turns. */
const letBotsPlay = async () => {
  // One step at a time: React only schedules the next bot move once it has rendered the last one.
  for (let i = 0; i < 40; i++) await reactAct(() => vi.advanceTimersByTimeAsync(710));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Texas Hold'em table", () => {
  it('starts in a lobby and takes the buy-in from your balance when you sit down', async () => {
    const user = renderTable();
    expect(screen.getByRole('button', { name: /sit down/i })).toBeEnabled();
    expect(balance()).toBe(1000);

    await user.click(screen.getByRole('button', { name: /sit down/i }));
    expect(balance()).toBe(900);
    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
    expect(screen.getByText(/pot/i)).toHaveTextContent('3'); // the two blinds
  });

  it("won't seat you without enough coins", () => {
    renderTable(60);
    expect(screen.getByRole('button', { name: /sit down/i })).toBeDisabled();
    expect(screen.getByText(/need at least 100 coins/i)).toBeInTheDocument();
  });

  it("hides the bots' cards, shows yours, and can't be left mid-hand", async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    expect(faceDown()).toBe(4); // two cards for each bot
    expect(screen.getByRole('button', { name: /leave table/i })).toBeDisabled();
    // The three actions are on offer on your first turn: facing the big blind you can fold, call or raise.
    expect(screen.getByRole('button', { name: /fold/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /call 2/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /raise to 4/i })).toBeEnabled();
  });

  it('plays the bots out after you fold, reveals their hands, and lets you leave with your chips', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    await user.click(screen.getByRole('button', { name: /fold/i }));
    await letBotsPlay();

    // The bots only call, so they reach a showdown and turn their cards up.
    expect(faceDown()).toBe(0);
    expect(screen.getByText(/wins|split/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /leave table/i }));
    expect(balance()).toBe(1000); // folded before putting anything in, so the full 100 comes back
    expect(screen.getByRole('button', { name: /sit down/i })).toBeEnabled();
    expect(screen.getByText(/you left the table with 100 coins/i)).toBeInTheDocument();
  });

  it('deals the next hand with the button moved on, and the bots act first', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    await user.click(screen.getByRole('button', { name: /fold/i }));
    await letBotsPlay();

    await user.click(screen.getByRole('button', { name: /next hand/i }));
    // Seat 1 has the button now, so Bot 1 acts first and you are the big blind.
    expect(screen.getByText(/bot 1 is thinking/i)).toBeInTheDocument();
    await letBotsPlay();
    // Bot 1 calls, Bot 2 (small blind) calls, and you get the big blind's option to check.
    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check/i })).toBeEnabled();
    expect(balance()).toBe(900); // still seated: the buy-in is on the table
  });

  it('pays you back what you win or lose when you play a hand through and leave', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    await user.click(screen.getByRole('button', { name: /call 2/i }));
    await letBotsPlay();
    // Check down every street until the hand ends.
    for (let i = 0; i < 12 && !screen.queryByRole('button', { name: /next hand/i }); i++) {
      const check = screen.queryByRole('button', { name: /^check$/i });
      if (check && !(check as HTMLButtonElement).disabled) await user.click(check);
      await letBotsPlay();
    }
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();

    const leave = screen.getByRole('button', { name: /leave table/i });
    const chips = Number(leave.textContent!.match(/\((\d+)\)/)![1]);
    await user.click(leave);
    expect(balance()).toBe(900 + chips); // the stack comes back to the wallet
    // Everyone put in 2 to a 6-chip pot: you lost it (98), won it (104), or split it two ways (101) or three (100).
    expect([98, 100, 101, 104]).toContain(chips);
  });
});

describe('going all in', () => {
  it('offers an All in button with the amount, and only on your turn', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    expect(screen.getByRole('button', { name: /all in \(100\)/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /fold/i }));
    // The bots are playing now, so it's not your turn and the button is switched off.
    expect(screen.getByRole('button', { name: /^all in/i })).toBeDisabled();
  });

  it('puts your chips in, runs the board out against calling bots, and pays out what you win', async () => {
    const user = renderTable();
    await user.click(screen.getByRole('button', { name: /sit down/i }));
    await user.click(screen.getByRole('button', { name: /all in \(100\)/i }));
    expect(screen.getByText(/you go all in \(100\)/i)).toBeInTheDocument();
    await letBotsPlay();

    // Everyone is all in, so the rest of the cards come out and the bots show their hands.
    expect(faceDown()).toBe(0);
    expect(screen.getByText(/wins|win|split/i)).toBeInTheDocument();

    // Next hand is not offered if you're out of chips. Either way you can cash out what is left.
    const leave = screen.getByRole('button', { name: /leave table/i });
    const chips = Number(leave.textContent!.match(/\((\d+)\)/)![1]);
    // You staked all 100: you lost it, won all 300, or split the pot two ways (150) or three (100).
    expect([0, 100, 150, 300]).toContain(chips);
    await user.click(leave);
    expect(balance()).toBe(900 + chips);
  });
});
