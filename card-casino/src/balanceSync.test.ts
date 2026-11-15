import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceSync, CONFLICT_NOTICE, RESET_NOTICE, type BalanceApi, type SyncState } from './balanceSync';
import { ApiError } from './api';

function setup(over: Partial<BalanceApi> = {}) {
  const api = {
    get: vi.fn(async () => ({ balance: 1000, version: 0 })),
    save: vi.fn(async (balance: number, version: number) => ({ balance, version: version + 1 })),
    ...over,
  } as unknown as BalanceApi & { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  const states: SyncState[] = [];
  const onUnauthorized = vi.fn();
  const sync = new BalanceSync(api, { onChange: (s) => states.push(s), onUnauthorized });
  return { api, sync, states, onUnauthorized };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('loading', () => {
  it('starts from the balance and version the server reports', async () => {
    const { sync, api } = setup({ get: vi.fn(async () => ({ balance: 750, version: 4 })) } as never);
    await sync.load();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(sync.state).toMatchObject({ balance: 750, version: 4, loaded: true, status: 'saved' });
  });

  it('reports not loaded until then', () => {
    const { sync } = setup();
    expect(sync.state.loaded).toBe(false);
  });
});

describe('saving', () => {
  it('changes the balance instantly but waits before saving', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    expect(sync.state.balance).toBe(900);
    await vi.advanceTimersByTimeAsync(499);
    expect(api.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.save).toHaveBeenCalledWith(900, 0, undefined);
  });

  it('coalesces rapid changes into one save of the latest value', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(300);
    sync.set(850);
    await vi.advanceTimersByTimeAsync(300);
    sync.set(1200);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith(1200, 0, undefined);
  });

  it('uses the new version for the next save', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(500);
    expect(sync.state.version).toBe(1);
    sync.set(800);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.save).toHaveBeenLastCalledWith(800, 1, undefined);
  });

  it('does not save when the balance ends up unchanged', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    sync.set(1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves again with the new version when it changed during a save', async () => {
    let finishFirst!: (v: { balance: number; version: number }) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)))
      .mockImplementation(async (balance: number, version: number) => ({ balance, version: version + 1 }));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(sync.state.status).toBe('saving');

    sync.set(700); // while the first save is in flight
    finishFirst({ balance: 900, version: 1 });
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(700, 1, undefined);
    expect(sync.state).toMatchObject({ balance: 700, version: 2, status: 'saved' });
  });

  it('flush saves immediately without waiting', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    await sync.flush();
    expect(api.save).toHaveBeenCalledWith(900, 0, undefined);
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('flush passes keepalive through for page unloads', async () => {
    const { sync, api } = setup();
    await sync.load();
    sync.set(900);
    await sync.flush({ keepalive: true });
    expect(api.save).toHaveBeenCalledWith(900, 0, { keepalive: true });
  });

  it('flush does nothing when there is nothing to save', async () => {
    const { sync, api } = setup();
    await sync.load();
    await sync.flush();
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe('when the server disagrees', () => {
  it('starts again from the server balance and version on a conflict, and tells the player', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 750, version: 4 }))
      .mockImplementation(async (balance: number, version: number) => ({ balance, version: version + 1 }));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(1200); // won 200 here
    await vi.advanceTimersByTimeAsync(500);
    expect(sync.state).toMatchObject({ balance: 950, version: 4, notice: CONFLICT_NOTICE }); // 750 + 200
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenLastCalledWith(950, 4, undefined); // saved on top of the server's version
    expect(sync.state.status).toBe('saved');
  });

  describe('what the player did here is kept when the server moved on', () => {
    it('keeps a bet on top of coins an admin gave in the meantime', async () => {
      // The player had 1000. An admin gave 1000 more (server: 2000, version 1). The player then bets it all.
      const save = vi
        .fn()
        .mockRejectedValueOnce(new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 2000, version: 1 }))
        .mockImplementation(async (balance: number, version: number) => ({ balance, version: version + 1 }));
      const { sync } = setup({ save } as never);
      await sync.load();
      sync.set(0); // all in
      await vi.advanceTimersByTimeAsync(500);
      // The gift arrives and the bet still counts: 2000 - 1000.
      expect(sync.state).toMatchObject({ balance: 1000, version: 1, notice: CONFLICT_NOTICE });
      await vi.advanceTimersByTimeAsync(500);
      expect(save).toHaveBeenLastCalledWith(1000, 1, undefined);
      expect(sync.state).toMatchObject({ balance: 1000, version: 2, status: 'saved' });
    });

    it('never goes below zero', async () => {
      const save = vi.fn().mockRejectedValueOnce(new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 300, version: 1 }));
      const { sync } = setup({ save } as never);
      await sync.load();
      sync.set(0); // bet 1000, but an admin has since taken the balance down to 300
      await vi.advanceTimersByTimeAsync(500);
      expect(sync.state.balance).toBe(0);
    });

    it('does not keep a balance the server rejected as invalid', async () => {
      const save = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'x'));
      const get = vi.fn().mockResolvedValueOnce({ balance: 1000, version: 0 }).mockResolvedValue({ balance: 800, version: 5 });
      const { sync } = setup({ save, get } as never);
      await sync.load();
      sync.set(5000);
      await vi.advanceTimersByTimeAsync(500);
      expect(sync.state).toMatchObject({ balance: 800, version: 5, notice: RESET_NOTICE });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('keeps a change made while the balance is being reloaded', async () => {
      let answer!: (v: { balance: number; version: number }) => void;
      const get = vi
        .fn()
        .mockResolvedValueOnce({ balance: 1000, version: 0 })
        .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
      const { sync, api } = setup({ get } as never);
      await sync.load();

      const reloading = sync.load(); // for example after a coin message
      sync.set(0); // the player bets everything while the answer is on its way
      answer({ balance: 2000, version: 1 }); // the server says an admin gave 1000
      await reloading;

      expect(sync.state.balance).toBe(1000); // 2000 - 1000, not 2000
      await vi.advanceTimersByTimeAsync(500);
      expect(api.save).toHaveBeenLastCalledWith(1000, 1, undefined);
    });

    it('does not make a change out of nothing when reloading with nothing unsaved', async () => {
      const get = vi.fn().mockResolvedValueOnce({ balance: 1000, version: 0 }).mockResolvedValue({ balance: 2000, version: 1 });
      const { sync, api } = setup({ get } as never);
      await sync.load();
      await sync.load();
      expect(sync.state).toMatchObject({ balance: 2000, version: 1 });
      await vi.advanceTimersByTimeAsync(5000);
      expect(api.save).not.toHaveBeenCalled();
    });
  });

  it('can clear the notice', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 750, version: 4 }));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(5000);
    await vi.advanceTimersByTimeAsync(500);
    sync.clearNotice();
    expect(sync.state.notice).toBeUndefined();
  });

  it('reloads the server value when the balance is rejected as invalid', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'x'));
    const get = vi.fn().mockResolvedValueOnce({ balance: 1000, version: 0 }).mockResolvedValueOnce({ balance: 600, version: 3 });
    const { sync } = setup({ save, get } as never);
    await sync.load();
    sync.set(99_000_000);
    await vi.advanceTimersByTimeAsync(500);
    expect(sync.state).toMatchObject({ balance: 600, version: 3, status: 'saved', notice: RESET_NOTICE });
  });

  it('asks to log in again when the session is rejected', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    const { sync, onUnauthorized } = setup({ save } as never);
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(500);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});

describe('when saving fails', () => {
  it('keeps the local balance, reports it, and retries with growing delays', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'))
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'x'))
      .mockImplementation(async (balance: number, version: number) => ({ balance, version: version + 1 }));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(sync.state).toMatchObject({ balance: 900, status: 'failed' });

    await vi.advanceTimersByTimeAsync(999);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // first retry after 1s
    expect(save).toHaveBeenCalledTimes(2);
    expect(sync.state.status).toBe('failed');

    await vi.advanceTimersByTimeAsync(1999);
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // second retry after 2s
    expect(save).toHaveBeenCalledTimes(3);
    expect(sync.state).toMatchObject({ balance: 900, version: 1, status: 'saved' });
  });

  it('never retries after being disposed', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(900);
    await vi.advanceTimersByTimeAsync(500);
    sync.dispose();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
