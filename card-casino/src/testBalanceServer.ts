import type { BalanceResponse } from './api';

/**
 * An in-memory stand-in for the balance API, for tests that render the real wallet.
 * Point the mocked `getBalance` and `saveBalance` at it. `state` is what the "server" holds.
 */
export function fakeBalanceServer(initialBalance = 1000) {
  const state: BalanceResponse = { balance: initialBalance, version: 0 };
  return {
    state,
    get: async (): Promise<BalanceResponse> => ({ ...state }),
    save: async (_token: string, req: BalanceResponse): Promise<BalanceResponse> => {
      state.balance = req.balance;
      state.version = req.version + 1;
      return { ...state };
    },
  };
}
