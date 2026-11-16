// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GameScope } from './statsRecorder';
import { useWinMark } from './bigWins';
import { WalletContext, useWallet, type WalletValue } from './wallet';
import { SessionContext, type Session } from './session';
import * as api from './api';
import type { WinKind } from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, recordStats: vi.fn(), reportWin: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
};

/** Everything that happens, in order, so a test can check the balance is saved before a win is reported. */
let events: string[] = [];
const fakeWallet = (): WalletValue =>
  ({
    balance: 1000,
    wager: () => true,
    settle: () => events.push('settle'),
    flush: async () => {
      events.push('flush');
    },
    refresh: async () => {},
    status: 'saved',
    dismissNotice: () => {},
  }) as WalletValue;

function Game({ mark }: { mark?: WinKind }) {
  const { wager, settle } = useWallet();
  const { markWin } = useWinMark();
  return (
    <div>
      <button onClick={() => wager(10)}>bet 10</button>
      <button onClick={() => wager(40)}>bet 40</button>
      <button onClick={() => mark && markWin(mark)}>mark</button>
      <button onClick={() => settle(8000)}>win 8000</button>
      <button onClick={() => settle(510)}>win 510</button>
      <button onClick={() => settle(500)}>win 500</button>
      <button onClick={() => settle(10)}>push</button>
      <button onClick={() => settle(0)}>lose</button>
    </div>
  );
}

const renderGame = (mark?: WinKind) =>
  render(
    <SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <WalletContext.Provider value={fakeWallet()}>
        <GameScope gameId="video-poker">
          <Game mark={mark} />
        </GameScope>
      </WalletContext.Provider>
    </SessionContext.Provider>,
  );
const press = async (...names: string[]) => {
  const user = userEvent.setup();
  for (const name of names) await user.click(screen.getByRole('button', { name }));
  await act(async () => {});
};

beforeEach(() => {
  vi.resetAllMocks();
  events = [];
  vi.mocked(api.recordStats).mockResolvedValue({ resultRecorded: true, secondsCredited: 0 });
  vi.mocked(api.reportWin).mockImplementation(async () => {
    events.push('report');
    return { confirmed: true, announced: true };
  });
});
afterEach(() => cleanup());

describe('a win the game marks', () => {
  it('is reported after the round, with the coins won on top of the bet and the bet', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    expect(api.reportWin).toHaveBeenCalledTimes(1);
    expect(api.reportWin).toHaveBeenCalledWith('tok', { win: 'royalFlush', prize: 7990, bet: 10 });
  });

  it('is reported only after the balance has been saved, so the server can see the rise', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    expect(events.indexOf('settle')).toBeLessThan(events.indexOf('flush'));
    expect(events.indexOf('flush')).toBeLessThan(events.indexOf('report'));
  });

  it('counts every bet of the round, such as a double down', async () => {
    renderGame('blackjack');
    await press('bet 10', 'bet 40', 'mark', 'win 8000');
    expect(api.reportWin).toHaveBeenCalledWith('tok', { win: 'blackjack', prize: 7950, bet: 50 });
  });

  it('is not reported when the round did not win any coins', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'push');
    await press('bet 10', 'mark', 'lose');
    expect(api.reportWin).not.toHaveBeenCalled();
  });

  it('is not reported when nothing was bet', async () => {
    renderGame('royalFlush');
    await press('mark', 'win 8000');
    expect(api.reportWin).not.toHaveBeenCalled();
  });

  it('is forgotten after the round, so the next round is not reported as it', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    await press('bet 10', 'win 500');
    expect(api.reportWin).toHaveBeenCalledTimes(1);
  });

  it('can be marked at any time before the round is settled, as at a poker table', async () => {
    renderGame('holdemRoyalFlush');
    await press('bet 10', 'mark', 'win 510'); // marked mid-sitting, settled when the player leaves
    expect(api.reportWin).toHaveBeenCalledWith('tok', { win: 'holdemRoyalFlush', prize: 500, bet: 10 });
  });
});

describe('a win nobody marked', () => {
  it('is reported as a big win when it pays at least fifty times the bet', async () => {
    renderGame();
    await press('bet 10', 'win 510');
    expect(api.reportWin).toHaveBeenCalledWith('tok', { win: 'bigWin', prize: 500, bet: 10 });
  });

  it('is not reported when it pays less than fifty times the bet', async () => {
    renderGame();
    await press('bet 10', 'win 500');
    expect(api.reportWin).not.toHaveBeenCalled();
  });

  it('is not reported for an ordinary win, a push or a loss', async () => {
    renderGame();
    await press('bet 10', 'push');
    await press('bet 10', 'lose');
    expect(api.reportWin).not.toHaveBeenCalled();
  });

  it('is reported once, as the named win, when it is both marked and huge', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    expect(api.reportWin).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.reportWin).mock.calls[0][1].win).toBe('royalFlush');
  });
});

describe('when reporting goes wrong', () => {
  it('never gets in the way of the game', async () => {
    vi.mocked(api.reportWin).mockRejectedValue(new Error('offline'));
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    expect(events).toContain('settle');
  });

  it('is not a problem if saving the balance fails first', async () => {
    renderGame('royalFlush');
    await press('bet 10', 'mark', 'win 8000');
    expect(api.reportWin).toHaveBeenCalled();
  });
});

describe('a game outside any scope', () => {
  it('can mark a win without anything happening', async () => {
    function Lonely() {
      const { markWin } = useWinMark();
      return <button onClick={() => markWin('royalFlush')}>mark</button>;
    }
    render(<Lonely />);
    await press('mark');
    expect(api.reportWin).not.toHaveBeenCalled();
  });
});
