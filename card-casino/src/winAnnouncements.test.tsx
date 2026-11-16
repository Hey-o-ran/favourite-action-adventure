// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WinAnnouncementsProvider, SEEN_KEY } from './winAnnouncements';
import { POLL_MS } from './abuseEvents';
import { AnnouncementBar } from './components/AnnouncementBar';
import { LanguageProvider, STORAGE_KEY, translate } from './i18n';
import { SessionContext, type Session } from './session';
import * as api from './api';
import { ApiError, type WinAnnouncement } from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, listWinAnnouncements: vi.fn() };
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
};
const logout = vi.fn();

const win = (over: Partial<WinAnnouncement> = {}): WinAnnouncement => ({
  announcementId: 'a1',
  displayName: 'Bob',
  verified: false,
  win: 'royalFlush',
  prize: 7990,
  createdAt: '2026-11-16T10:00:00.000Z',
  ...over,
});

const tree = () => (
  <LanguageProvider>
    <SessionContext.Provider value={{ session, logout }}>
      <WinAnnouncementsProvider>
        <AnnouncementBar />
      </WinAnnouncementsProvider>
    </SessionContext.Provider>
  </LanguageProvider>
);

async function start(list: WinAnnouncement[] = []) {
  vi.mocked(api.listWinAnnouncements).mockResolvedValue({ announcements: list });
  const view = render(tree());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return view;
}
const poll = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(POLL_MS);
  });

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('big win banners', () => {
  it('tells everyone who hit what, and what they won', async () => {
    await start([win()]);
    expect(screen.getByText('BIG WIN')).toBeInTheDocument();
    expect(screen.getByText('Bob hit a royal flush in Jacks or Better! They won 7,990 coins.')).toBeInTheDocument();
    expect(api.listWinAnnouncements).toHaveBeenCalledWith('tok');
  });

  it('shows an admin with the blue check', async () => {
    await start([win({ verified: true })]);
    expect(screen.getByRole('img', { name: /verified admin/i })).toBeInTheDocument();
  });

  it('shows no blue check for an ordinary player', async () => {
    await start([win()]);
    expect(screen.queryByRole('img', { name: /verified admin/i })).not.toBeInTheDocument();
  });

  it('has a way to word every kind of win', () => {
    const kinds = ['royalFlush', 'straightFlush', 'slotsJackpot', 'rouletteNumber', 'blackjack', 'landlordSpring', 'landlordRocket', 'higherLowerJackpot', 'holdemRoyalFlush', 'holdemStraightFlush', 'ginGin', 'bigWin'];
    for (const kind of kinds) expect(translate('en-GB', `win.${kind}` as never), kind).toBeTruthy();
  });

  it('picks up a new win on a later check', async () => {
    await start([]);
    vi.mocked(api.listWinAnnouncements).mockResolvedValue({ announcements: [win({ announcementId: 'a2', win: 'slotsJackpot', prize: 990 })] });
    await poll();
    expect(await screen.findByText('Bob hit the Slots jackpot! They won 990 coins.')).toBeInTheDocument();
  });

  it('shows several, newest first', async () => {
    await start([win({ announcementId: 'new', displayName: 'Cy', win: 'blackjack', prize: 15 }), win({ announcementId: 'old' })]);
    const text = screen.getAllByRole('status').map((el) => el.textContent ?? '');
    expect(text.findIndex((t) => t.includes('Cy hit Blackjack'))).toBeLessThan(text.findIndex((t) => t.includes('Bob hit a royal flush')));
  });
});

describe('seeing each win only once', () => {
  it('does not bring a win back on the next check', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await start([win()]);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText(/Bob hit/)).not.toBeInTheDocument();
    await poll();
    expect(screen.queryByText(/Bob hit/)).not.toBeInTheDocument();
  });

  it('remembers a win it has shown, so a reload does not show it again', async () => {
    const first = await start([win()]);
    expect(screen.getByText(/Bob hit/)).toBeInTheDocument();
    first.unmount();
    await start([win()]);
    expect(screen.queryByText(/Bob hit/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(SEEN_KEY)).toContain('a1');
  });

  it('does not show the same win twice when it is listed again', async () => {
    await start([win()]);
    await poll();
    expect(screen.getAllByText(/Bob hit/)).toHaveLength(1);
  });
});

describe('in Chinese', () => {
  it('words the banner in Chinese, whatever language the server uses', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    await start([win()]);
    expect(screen.getByText(translate('zh-CN', 'announce.winTitle'))).toBeInTheDocument();
    expect(
      screen.getByText(translate('zh-CN', 'announce.bigWin', { name: 'Bob', win: translate('zh-CN', 'win.royalFlush'), prize: 7990 })),
    ).toBeInTheDocument();
  });
});

describe('when things go wrong', () => {
  it('logs out when the session is rejected', async () => {
    vi.mocked(api.listWinAnnouncements).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    render(tree());
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('stays quiet when the announcements cannot be loaded, and tries again later', async () => {
    vi.mocked(api.listWinAnnouncements).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'x'));
    render(tree());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.mocked(api.listWinAnnouncements).mockResolvedValue({ announcements: [win()] });
    await poll();
    expect(await screen.findByText(/Bob hit/)).toBeInTheDocument();
  });
});
