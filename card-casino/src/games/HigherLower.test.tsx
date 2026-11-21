// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { shuffle } from '../cards';
import { LanguageProvider, STORAGE_KEY } from '../i18n';
import { WalletContext, type WalletValue } from '../wallet';
import { DEAL_LOCK_MS } from '../useDealLock';
import { HigherLower } from './HigherLower';

vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));
const wager = vi.fn(() => true);
const settle = vi.fn();
const wallet: WalletValue = { balance: 1000, wager, settle, flush: async () => {}, refresh: async () => {}, status: 'saved', dismissNotice: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(shuffle).mockReturnValue([{ rank: 5, suit: 'spades' }, { rank: 8, suit: 'hearts' }, { rank: 2, suit: 'clubs' }]);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); vi.useRealTimers(); });

it('offers optional guidance as a round progresses without changing wagers', async () => {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(<WalletContext.Provider value={wallet}><HigherLower /></WalletContext.Provider>);
  expect(screen.queryByText(/choose a bet and start/i)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /show higher or lower guide/i }));
  expect(screen.getByText(/choose a bet and start/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^start$/i }));
  expect(screen.getByText(/aces are high/i)).toBeInTheDocument();
  await act(() => vi.advanceTimersByTime(DEAL_LOCK_MS));
  await user.click(screen.getByRole('button', { name: /^higher/i }));
  expect(screen.getByText(/cash out to keep it/i)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /cash out/i }));
  expect(screen.getByText(/the round is over/i)).toBeInTheDocument();
  expect(wager).toHaveBeenCalledTimes(1);
  expect(settle).toHaveBeenCalledWith(15);
  await user.click(screen.getByRole('button', { name: /hide guide/i }));
  expect(screen.queryByText(/the round is over/i)).not.toBeInTheDocument();
});

it('offers the guide in Chinese', async () => {
  localStorage.setItem(STORAGE_KEY, 'zh-CN');
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(<LanguageProvider><WalletContext.Provider value={wallet}><HigherLower /></WalletContext.Provider></LanguageProvider>);
  await user.click(screen.getByRole('button', { name: '\u663e\u793a\u6bd4\u5927\u5c0f\u6307\u5357' }));
  expect(screen.getByText('\u9009\u62e9\u4e0b\u6ce8\u91d1\u989d\u5e76\u5f00\u59cb\uff0c\u7cfb\u7edf\u4f1a\u53d1\u4e00\u5f20\u660e\u724c\u3002')).toBeInTheDocument();
});
