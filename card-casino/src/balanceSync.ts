import { ApiError } from './api';

export interface BalanceApi {
  get(): Promise<{ balance: number; version: number }>;
  save(balance: number, version: number, options?: { keepalive?: boolean }): Promise<{ balance: number; version: number }>;
}

export interface SyncState {
  /** The balance shown to the player; always the latest, even before it is saved. */
  balance: number;
  /** Server version the next save is based on. */
  version: number;
  loaded: boolean;
  /** `failed` means the latest balance has not reached the server yet and a retry is scheduled. */
  status: 'saved' | 'saving' | 'failed';
  notice?: string;
}

export interface SyncHooks {
  onChange(state: SyncState): void;
  onUnauthorized(): void;
}

export const CONFLICT_NOTICE = 'Your balance changed on another device and was refreshed.';
export const RESET_NOTICE = 'Your balance could not be saved and was reset to the last saved value.';

const SAVE_DELAY_MS = 500;
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Keeps the coin balance on screen and on the server in step.
 * The screen updates instantly; saves are debounced, serialised, retried on failure,
 * and the server's value wins whenever it disagrees.
 */
export class BalanceSync {
  private current: SyncState = { balance: 0, version: 0, loaded: false, status: 'saved' };
  private savedBalance = 0;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<void>;
  private failures = 0;
  private disposed = false;

  constructor(
    private readonly api: BalanceApi,
    private readonly hooks: SyncHooks,
    private readonly saveDelayMs = SAVE_DELAY_MS,
  ) {}

  /** Always the latest state, so back-to-back changes in one event see each other. */
  get state(): SyncState {
    return this.current;
  }

  async load(): Promise<void> {
    const server = await this.api.get();
    this.savedBalance = server.balance;
    this.update({ balance: server.balance, version: server.version, loaded: true, status: 'saved' });
  }

  set(balance: number): void {
    if (!this.current.loaded || this.disposed) return;
    this.update({ balance });
    this.scheduleSave();
  }

  clearNotice(): void {
    this.update({ notice: undefined });
  }

  /** Saves right now (used on logout and when the page is closing). */
  async flush(options?: { keepalive?: boolean }): Promise<void> {
    this.clearTimers();
    if (this.inFlight) await this.inFlight;
    this.clearTimers();
    await this.save(options);
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  private update(patch: Partial<SyncState>): void {
    this.current = { ...this.current, ...patch };
    this.hooks.onChange(this.current);
  }

  private clearTimers(): void {
    clearTimeout(this.saveTimer);
    clearTimeout(this.retryTimer);
    this.saveTimer = undefined;
    this.retryTimer = undefined;
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    if (this.current.balance === this.savedBalance && this.current.status !== 'failed') return;
    this.saveTimer = setTimeout(() => void this.save(), this.saveDelayMs);
  }

  private save(options?: { keepalive?: boolean }): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (this.current.balance === this.savedBalance) return Promise.resolve();

    const sent = this.current.balance;
    this.update({ status: 'saving' });
    this.inFlight = this.api
      .save(sent, this.current.version, options)
      .then(
        (saved) => {
          this.failures = 0;
          this.savedBalance = saved.balance;
          this.update({ version: saved.version, status: 'saved' });
        },
        (err) => this.handleFailure(err),
      )
      .finally(() => {
        this.inFlight = undefined;
        this.afterSettled();
      });
    return this.inFlight;
  }

  private async handleFailure(err: unknown): Promise<void> {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        this.hooks.onUnauthorized();
        return;
      }
      if (err.status === 409) {
        const server = err.details as { balance?: number; version?: number } | undefined;
        if (typeof server?.balance === 'number' && typeof server.version === 'number') {
          this.takeServerValue(server.balance, server.version, CONFLICT_NOTICE);
          return;
        }
      }
      if (err.status === 400) {
        try {
          const server = await this.api.get();
          this.takeServerValue(server.balance, server.version, RESET_NOTICE);
          return;
        } catch {
          // Fall through and treat it like any other failure.
        }
      }
    }
    this.failures += 1;
    this.update({ status: 'failed' });
  }

  private takeServerValue(balance: number, version: number, notice: string): void {
    this.failures = 0;
    this.savedBalance = balance;
    this.clearTimers();
    this.update({ balance, version, status: 'saved', notice });
  }

  private afterSettled(): void {
    if (this.disposed) return;
    if (this.current.status === 'failed') {
      const delay = RETRY_DELAYS_MS[Math.min(this.failures - 1, RETRY_DELAYS_MS.length - 1)];
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => void this.save(), delay);
    } else if (this.current.balance !== this.savedBalance) {
      this.scheduleSave();
    }
  }
}
