// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as api from './api';
import { SessionContext, type Session } from './session';
import { WalletContext, useWallet, type WalletValue } from './wallet';
import { GameScope, IDLE_AFTER_MS, REPORT_EVERY_SECONDS, outcomeOf, usePlaytime } from './statsRecorder';

vi.mock('./api', async (orig) => ({ ...(await orig<typeof import('./api')>()), recordStats: vi.fn() }));

const session: Session = { idToken: 'tok', expiresAt: Date.now() + 3_600_000, user: { userId: 'u1', email: 'a@b.c', displayName: 'Ada', isAdmin: false } };
const sessionValue = { session, logout: vi.fn() };

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

const recorded = () => vi.mocked(api.recordStats).mock.calls.map(([token, report]) => ({ token, ...report }));

/** A stand-in game that bets and settles as the real ones do. */
function FakeGame() {
  const { wager: bet, settle: payOut } = useWallet();
  return (
    <div>
      <button onClick={() => bet(100)}>bet 100</button>
      <button onClick={() => bet(50)}>bet 50</button>
      <button onClick={() => payOut(0)}>lose</button>
      <button onClick={() => payOut(150)}>get 150</button>
      <button onClick={() => payOut(100)}>get 100</button>
      <button onClick={() => payOut(300)}>get 300</button>
    </div>
  );
}
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

function renderGame(gameId = 'blackjack') {
  return render(
    <SessionContext.Provider value={sessionValue}>
      <WalletContext.Provider value={wallet()}>
        <GameScope gameId={gameId}>
          <FakeGame />
        </GameScope>
      </WalletContext.Provider>
    </SessionContext.Provider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-16T10:00:00Z') });
  vi.resetAllMocks();
  wager.mockReturnValue(true);
  vi.mocked(api.recordStats).mockResolvedValue({ resultRecorded: true, secondsCredited: 0 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('how a round ended', () => {
  it('is a win when more coins come back than went in, a draw when it is exactly the bet, a loss when it is less', () => {
    expect(outcomeOf(100, 200)).toBe('win');
    expect(outcomeOf(100, 101)).toBe('win');
    expect(outcomeOf(100, 100)).toBe('draw');
    expect(outcomeOf(100, 99)).toBe('loss');
    expect(outcomeOf(100, 0)).toBe('loss');
  });
});

describe('a game reporting its results', () => {
  it('reports a win, with the game it was played in', () => {
    renderGame('roulette');
    press('bet 100');
    press('get 300');
    expect(recorded()).toEqual([{ token: 'tok', game: 'roulette', result: 'win' }]);
  });

  it('reports a draw when the bet comes back, and a loss when nothing does', () => {
    renderGame();
    press('bet 100');
    press('get 100');
    press('bet 100');
    press('lose');
    expect(recorded().map((r) => r.result)).toEqual(['draw', 'loss']);
  });

  it('adds up several bets in one round, like a blackjack double', () => {
    renderGame();
    press('bet 100');
    press('bet 50'); // 150 in all
    press('get 150'); // exactly the 150 put in: a draw, not a win
    expect(recorded()).toEqual([{ token: 'tok', game: 'blackjack', result: 'draw' }]);
  });

  it('judges the next round only by its own bets', () => {
    renderGame();
    press('bet 100');
    press('bet 50');
    press('lose');
    press('bet 50');
    press('get 100');
    expect(recorded().map((r) => r.result)).toEqual(['loss', 'win']);
  });

  it('reports a round once, however it is settled', () => {
    renderGame();
    press('bet 100');
    press('get 300');
    press('get 300'); // a second settle with nothing behind it
    expect(recorded()).toHaveLength(1);
  });

  it('does not report a settle that has no bet behind it', () => {
    renderGame();
    press('get 300');
    expect(recorded()).toEqual([]);
  });

  it('does not count a bet the wallet refused', () => {
    wager.mockReturnValue(false);
    renderGame();
    press('bet 100');
    press('get 300');
    expect(recorded()).toEqual([]);
  });

  it('passes every bet and payout on to the real wallet, unchanged', () => {
    renderGame();
    press('bet 100');
    press('get 150');
    expect(wager).toHaveBeenCalledWith(100);
    expect(settle).toHaveBeenCalledWith(150);
  });

  it('keeps each game apart', () => {
    render(
      <SessionContext.Provider value={sessionValue}>
        <WalletContext.Provider value={wallet()}>
          <GameScope gameId="slots">
            <div data-testid="slots">
              <FakeGame />
            </div>
          </GameScope>
          <GameScope gameId="holdem">
            <div data-testid="holdem">
              <FakeGame />
            </div>
          </GameScope>
        </WalletContext.Provider>
      </SessionContext.Provider>,
    );
    const inGame = (id: string, name: string) => fireEvent.click(screen.getByTestId(id).querySelector(`button:nth-of-type(${name})`)!);
    inGame('slots', '1'); // bet 100 in slots
    inGame('holdem', '4'); // settle in hold'em with no bet there: nothing to report
    expect(recorded()).toEqual([]);
    inGame('slots', '3'); // lose in slots
    expect(recorded()).toEqual([{ token: 'tok', game: 'slots', result: 'loss' }]);
  });

  it('never gets in the way of the game when a report fails', async () => {
    vi.mocked(api.recordStats).mockRejectedValue(new Error('offline'));
    renderGame();
    press('bet 100');
    expect(() => press('lose')).not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
    expect(settle).toHaveBeenCalledWith(0);
  });
});

function Counter({ game, enabled }: { game: string; enabled: boolean }) {
  usePlaytime(game, enabled);
  return null;
}
const mountPlaytime = (game = 'slots', enabled = true) =>
  render(
    <SessionContext.Provider value={sessionValue}>
      <Counter game={game} enabled={enabled} />
    </SessionContext.Provider>,
  );
const tick = (seconds: number) => act(() => void vi.advanceTimersByTime(seconds * 1000));
const secondsFor = (game: string) =>
  recorded()
    .filter((r) => r.game === game)
    .reduce((n, r) => n + (r.seconds ?? 0), 0);
const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('counting play time', () => {
  afterEach(() => setVisibility('visible'));

  it('reports 30 seconds at a time while the player is active', () => {
    mountPlaytime();
    tick(29);
    expect(recorded()).toEqual([]);
    tick(1);
    expect(recorded()).toEqual([{ token: 'tok', game: 'slots', seconds: REPORT_EVERY_SECONDS }]);
    tick(30);
    expect(recorded()).toHaveLength(2);
  });

  it('counts nothing while a game is not on screen, such as on the rules page', () => {
    mountPlaytime('slots', false);
    tick(120);
    expect(recorded()).toEqual([]);
  });

  it('counts nothing while the tab is hidden', () => {
    mountPlaytime();
    setVisibility('hidden');
    tick(120);
    expect(secondsFor('slots')).toBe(0);
  });

  it('stops counting when the player has done nothing for two minutes, and starts again when they do something', () => {
    mountPlaytime();
    tick(IDLE_AFTER_MS / 1000 + 60);
    expect(secondsFor('slots')).toBe(IDLE_AFTER_MS / 1000); // the first two minutes, then nothing
    fireEvent.pointerDown(window);
    tick(30);
    expect(secondsFor('slots')).toBe(IDLE_AFTER_MS / 1000 + 30);
  });

  it('counts a player who keeps clicking for as long as they play', () => {
    mountPlaytime();
    for (let i = 0; i < 6; i++) {
      tick(60);
      fireEvent.keyDown(window, { key: 'a' });
    }
    expect(secondsFor('slots')).toBe(360);
  });

  it('hands in what has been counted when they switch games, to the game they were playing', () => {
    const { rerender } = mountPlaytime('slots');
    tick(10);
    rerender(
      <SessionContext.Provider value={sessionValue}>
        <Counter game="roulette" enabled />
      </SessionContext.Provider>,
    );
    expect(recorded()).toEqual([{ token: 'tok', game: 'slots', seconds: 10 }]);
    tick(30);
    expect(secondsFor('roulette')).toBe(30);
    expect(secondsFor('slots')).toBe(10);
  });

  it('hands in what has been counted when they leave the game screens', () => {
    const { rerender } = mountPlaytime('slots', true);
    tick(12);
    rerender(
      <SessionContext.Provider value={sessionValue}>
        <Counter game="slots" enabled={false} />
      </SessionContext.Provider>,
    );
    expect(secondsFor('slots')).toBe(12);
  });

  it('hands in what has been counted when the tab is hidden, and when the page closes', () => {
    const view = mountPlaytime();
    tick(7);
    setVisibility('hidden');
    expect(secondsFor('slots')).toBe(7);
    setVisibility('visible');
    tick(5);
    view.unmount();
    expect(secondsFor('slots')).toBe(12);
  });

  it('never claims more than a minute in one report', () => {
    mountPlaytime();
    tick(600);
    for (const r of recorded()) expect(r.seconds).toBeLessThanOrEqual(60);
  });

  it('does not report when nothing was counted', () => {
    const view = mountPlaytime();
    view.unmount();
    expect(recorded()).toEqual([]);
  });

  it('carries on if a report fails', () => {
    vi.mocked(api.recordStats).mockRejectedValue(new Error('offline'));
    mountPlaytime();
    expect(() => tick(60)).not.toThrow();
  });
});
