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
  it('takes the server value on a version conflict and tells the player', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(409, 'VERSION_CONFLICT', 'x', undefined, { balance: 750, version: 4 }));
    const { sync } = setup({ save } as never);
    await sync.load();
    sync.set(5000);
    await vi.advanceTimersByTimeAsync(500);
    expect(sync.state).toMatchObject({ balance: 750, version: 4, status: 'saved', notice: CONFLICT_NOTICE });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1); // no retry
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
