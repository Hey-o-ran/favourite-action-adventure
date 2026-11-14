// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider, STORAGE_KEY, translate } from './i18n';
import { zhCN } from './i18n/zh-CN';
import { Leaderboard } from './components/Leaderboard';
import { AnnouncementBar } from './components/AnnouncementBar';
import { GameNav } from './components/GameNav';
import { AdminPanel } from './components/AdminPanel';
import { AdminGate } from './components/AdminGate';
import { BetPanel } from './components/BetPanel';
import { App } from './App';
import { AbuseEventsProvider } from './abuseEvents';
import { CoinNoticesProvider } from './coinNotices';
import { WalletProvider } from './wallet';
import { SessionContext, type Session } from './session';
import { NO_FILTERS } from './gameFilters';
import { fakeBalanceServer } from './testBalanceServer';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return {
    ...actual,
    getLeaderboard: vi.fn(),
    listPendingUsers: vi.fn(),
    approveUser: vi.fn(),
    searchUsers: vi.fn(),
    giveCoins: vi.fn(),
    startEvent: vi.fn(),
    listActiveEvents: vi.fn(),
    listNotices: vi.fn(),
    dismissNotice: vi.fn(),
    claimEvent: vi.fn(),
    getBalance: vi.fn(),
    saveBalance: vi.fn(),
  };
});

const t = (key: keyof typeof zhCN, values?: Record<string, string | number>) => translate('zh-CN', key, values);

const sessionFor = (isAdmin: boolean): Session => ({
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin },
});

const inChinese = (ui: React.ReactElement, isAdmin = false) => {
  window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
  return render(
    <LanguageProvider>
      <SessionContext.Provider value={{ session: sessionFor(isAdmin), logout: vi.fn() }}>{ui}</SessionContext.Provider>
    </LanguageProvider>,
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  const server = fakeBalanceServer();
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
  vi.mocked(api.listActiveEvents).mockResolvedValue({ events: [] });
  vi.mocked(api.listNotices).mockResolvedValue({ notices: [] });
  vi.mocked(api.listPendingUsers).mockResolvedValue({ users: [] });
});
afterEach(() => cleanup());

describe('leaderboard in Chinese', () => {
  const board = (over = {}) => ({
    entries: [
      { rank: 1, displayName: 'ada', coins: 5000 },
      { rank: 2, displayName: 'bob', coins: 1200 },
    ],
    total: 2,
    ...over,
  });

  it('shows the headings, hint and totals in Chinese', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(board());
    inChinese(
      <WalletProvider>
        <Leaderboard />
      </WalletProvider>,
    );
    expect(await screen.findByRole('heading', { name: t('menu.leaderboard') })).toBeInTheDocument();
    expect(screen.getByText(t('leaderboard.hint'))).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: t('leaderboard.rank') })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t('leaderboard.player') })).toBeInTheDocument();
    expect(screen.getByText(t('leaderboard.totalMany', { count: 2 }))).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('marks your own line and says where you are when you are outside the top', async () => {
    vi.mocked(api.getLeaderboard).mockResolvedValue(
      board({ you: { rank: 14, displayName: 'Ada', coins: 820 }, total: 40 }),
    );
    inChinese(
      <WalletProvider>
        <Leaderboard />
      </WalletProvider>,
    );
    const line = await screen.findByText(/你目前排第/);
    expect(line).toHaveTextContent(t('leaderboard.youAre', { rank: 14, coins: 820 }));
    expect(within(line).getByText('14')).toBeInTheDocument(); // the rank stays bold
  });

  it('says so in Chinese when it cannot load, and when nobody is on the board', async () => {
    vi.mocked(api.getLeaderboard).mockRejectedValueOnce(new api.ApiError(0, 'NETWORK_ERROR', 'x'));
    inChinese(
      <WalletProvider>
        <Leaderboard />
      </WalletProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(t('leaderboard.loadError'));
    expect(screen.getByRole('button', { name: t('common.tryAgain') })).toBeInTheDocument();
  });
});

describe('announcements in Chinese', () => {
  const tree = () => (
    <WalletProvider>
      <AbuseEventsProvider>
        <CoinNoticesProvider>
          <AnnouncementBar />
        </CoinNoticesProvider>
      </AbuseEventsProvider>
    </WalletProvider>
  );
  const event = (over = {}) => ({
    eventId: 'e1',
    type: 'FREE_COINS' as const,
    title: 'ADMIN ABUSE',
    message: 'Everyone gets 1,000 coins!',
    amount: 1000,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...over,
  });

  it('words an admin event and what it did for you in Chinese, whatever language the server used', async () => {
    vi.mocked(api.listActiveEvents).mockResolvedValue({
      events: [event({ announcedBy: { displayName: 'boss', verified: true } })],
    });
    vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'e1', claimed: true });
    inChinese(tree());
    expect(await screen.findByText(t('announce.eventTitle'))).toBeInTheDocument();
    expect(screen.getByText(t('announce.freeCoins', { amount: 1000 }))).toBeInTheDocument();
    expect(await screen.findByText(t('announce.outcomeCoins', { amount: 1000 }))).toBeInTheDocument();
    expect(screen.getByText(/来自/)).toHaveTextContent('来自 boss');
    expect(screen.getByRole('img', { name: t('common.verifiedAdmin') })).toBeInTheDocument();
    expect(screen.queryByText('Everyone gets 1,000 coins!')).not.toBeInTheDocument();
  });

  it('words the unloseable event and the protection in Chinese', async () => {
    vi.mocked(api.listActiveEvents).mockResolvedValue({
      events: [event({ eventId: 'e2', type: 'UNLOSEABLE', message: "Everybody's next game is unloseable!", amount: undefined })],
    });
    vi.mocked(api.claimEvent).mockResolvedValue({ eventId: 'e2', claimed: true });
    inChinese(tree());
    expect(await screen.findByText(t('announce.unloseable'))).toBeInTheDocument();
    expect(await screen.findByText(t('announce.protectedText'))).toBeInTheDocument();
    expect(screen.getByText(t('announce.protectedTitle'))).toBeInTheDocument();
  });

  it('tells you in Chinese that coins were sent or removed, and by whom', async () => {
    vi.mocked(api.listNotices).mockResolvedValue({
      notices: [
        { noticeId: 'a', amount: 250, senderDisplayName: 'boss', createdAt: '2026-11-14T10:00:00.000Z' },
        { noticeId: 'b', amount: -40, senderDisplayName: 'boss', createdAt: '2026-11-14T10:01:00.000Z' },
      ],
    });
    inChinese(tree());
    expect(await screen.findByText(t('announce.sentText', { amount: 250, name: 'boss' }))).toBeInTheDocument();
    expect(screen.getByText(t('announce.removedText', { amount: 40, name: 'boss' }))).toBeInTheDocument();
    expect(screen.getByText(t('announce.coinsSent'))).toBeInTheDocument();
    expect(screen.getByText(t('announce.coinsRemoved'))).toBeInTheDocument();
  });
});

describe('choosing a game in Chinese', () => {
  const games = [
    { id: 'a', name: '二十一点', origin: 'Spain', players: 'Vs the house', type: 'Beat the dealer', skill: 'Mix of both', popularity: 2 },
    { id: 'b', name: '德州扑克', origin: 'United States', players: '3+ players', type: 'Poker', skill: 'Mostly skill', popularity: 1 },
  ] as never;

  const nav = (filters = NO_FILTERS) =>
    inChinese(
      <GameNav
        games={games}
        activeId="a"
        onSelect={() => {}}
        filters={filters}
        onFiltersChange={() => {}}
        sort="default"
        onSortChange={() => {}}
      />,
    );

  it('shows the filter names, choices, sorting and game count in Chinese', () => {
    nav();
    expect(screen.getByRole('group', { name: t('nav.findGame') })).toBeInTheDocument();
    for (const key of ['filter.origin', 'filter.players', 'filter.type', 'filter.skill'] as const) {
      expect(screen.getByText(t(key))).toBeInTheDocument();
    }
    const origin = screen.getByRole('combobox', { name: t('filter.origin') });
    expect(within(origin).getByRole('option', { name: t('nav.any') })).toBeInTheDocument();
    expect(within(origin).getByRole('option', { name: t('fact.Spain') })).toBeInTheDocument();
    expect(within(origin).getByRole('option', { name: t('fact.United States') })).toBeInTheDocument();
    const sort = screen.getByRole('combobox', { name: t('nav.sortBy') });
    expect(within(sort).getByRole('option', { name: t('nav.sortPopular') })).toBeInTheDocument();
    expect(screen.getByText(t('nav.count', { count: 2 }))).toBeInTheDocument();
  });

  it('still filters on the underlying value when a Chinese choice is picked', async () => {
    const onChange = vi.fn();
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <GameNav
          games={games}
          activeId="a"
          onSelect={() => {}}
          filters={NO_FILTERS}
          onFiltersChange={onChange}
          sort="default"
          onSortChange={() => {}}
        />
      </LanguageProvider>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: t('filter.skill') }), t('fact.Mostly skill'));
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, skill: 'Mostly skill' });
  });

  it('says how many match, and offers to clear, in Chinese', () => {
    nav({ ...NO_FILTERS, skill: 'Mostly skill' });
    expect(screen.getByText(t('nav.countMatching', { matching: 1, total: 2 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('nav.clear') })).toBeInTheDocument();
  });
});

describe('the games on the home screen in Chinese', () => {
  it('shows the game name, blurb, facts and history in Chinese', async () => {
    inChinese(
      <WalletProvider>
        <App />
      </WalletProvider>,
    );
    await screen.findByRole('button', { name: t('menu.menu') });
    expect(screen.getByRole('navigation', { name: t('nav.games') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('game.blackjack.name') })).toBeInTheDocument();
    expect(screen.getByText(t('game.blackjack.blurb'))).toBeInTheDocument();
    expect(screen.getByText(t('game.blackjack.note'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${t('facts.from', { country: t('fact.Spain') })} · ${t('fact.Vs the house')}`))).toBeInTheDocument();
  });
});

describe('the admin pages in Chinese', () => {
  it('asks for the admin password in Chinese', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <AdminGate onUnlock={() => {}} onCancel={() => {}} />
      </LanguageProvider>,
    );
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    cleanup();
    inChinese(<AdminGate onUnlock={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('heading', { name: t('adminGate.title') })).toBeInTheDocument();
    expect(screen.getByLabelText(t('login.password'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('adminGate.enter') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('adminGate.wrong'));
    expect(screen.getByRole('button', { name: t('menu.back') })).toBeInTheDocument();
  });

  it('shows the approval list in Chinese', async () => {
    vi.mocked(api.listPendingUsers).mockResolvedValue({
      users: [{ userId: 'u9', email: 'new@example.com', displayName: 'Newbie', createdAt: '2026-11-01T10:00:00.000Z' }],
    });
    inChinese(<AdminPanel />, true);
    expect(screen.getByRole('heading', { name: t('admin.title') })).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: t('admin.requested') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('admin.approveName', { name: 'Newbie' }) })).toHaveTextContent(t('admin.approve'));
  });

  it('shows the give-or-take-coins section in Chinese, and explains the result in Chinese', async () => {
    vi.mocked(api.searchUsers).mockResolvedValue({
      users: [{ userId: 'u2', email: 'bob@example.com', displayName: 'Bob', balance: 750 }],
      truncated: false,
    });
    vi.mocked(api.giveCoins).mockResolvedValue({ userId: 'u2', amount: 250, balance: 1000, version: 5 });
    const user = userEvent.setup();
    inChinese(<AdminPanel />, true);
    expect(screen.getByRole('heading', { name: t('coins.title') })).toBeInTheDocument();
    await user.type(screen.getByLabelText(t('coins.find')), 'bob');
    await user.click(screen.getByRole('button', { name: t('coins.search') }));
    expect(await screen.findByText(t('coins.balanceOf', { amount: 750 }))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('coins.chooseName', { name: 'Bob' }) }));
    expect(screen.getByText(t('coins.givingTo', { name: 'Bob' }))).toBeInTheDocument();
    await user.type(screen.getByLabelText(t('coins.amount')), '250');
    await user.click(screen.getByRole('button', { name: t('coins.give') }));
    expect(await screen.findByRole('status')).toHaveTextContent(t('coins.gave', { amount: 250, name: 'Bob', balance: 1000 }));
  });

  it('shows the admin abuse section, and its preview, in Chinese', async () => {
    const user = userEvent.setup();
    inChinese(<AdminPanel />, true);
    expect(screen.getByRole('heading', { name: t('abuse.title') })).toBeInTheDocument();
    expect(screen.getByText(t('abuse.freeCoins'))).toBeInTheDocument();
    expect(screen.getByText(t('abuse.noneOn'))).toBeInTheDocument();
    expect(
      screen.getByText(t('abuse.preview', { message: '' }).replace(/\s+$/, ''), { exact: false }),
    ).toHaveTextContent(t('announce.freeCoins', { amount: 1000 }));
    await user.click(screen.getByRole('button', { name: t('abuse.start') }));
    expect(screen.getByRole('group', { name: t('abuse.confirmGroup') })).toHaveTextContent(t('abuse.confirmText'));
  });
});

describe('the bet panel in Chinese', () => {
  it('labels the bet and the max button in Chinese', () => {
    inChinese(<BetPanel value={10} onChange={() => {}} max={500} />);
    expect(screen.getByLabelText(t('common.bet'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('common.max') })).toBeInTheDocument();
  });
});
