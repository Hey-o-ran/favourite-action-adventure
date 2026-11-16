// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AdminCoins } from './AdminCoins';
import { SessionContext, type Session } from '../session';
import * as api from '../api';
import { ApiError, type Ban, type FoundUser } from '../api';

vi.mock('../api', async (orig) => ({
  ...(await orig<typeof import('../api')>()),
  searchUsers: vi.fn(),
  giveCoins: vi.fn(),
  banUser: vi.fn(),
  liftBan: vi.fn(),
  listBans: vi.fn(),
}));

const session: Session = { idToken: 'admin-token', expiresAt: Date.now() + 60_000, user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true } };
const logout = vi.fn();
const bob: FoundUser = { userId: 'u2', email: 'bob@example.com', displayName: 'Bob', balance: 750 };
const ada: FoundUser = { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', balance: 100 };

const ban = (over: Partial<Ban> = {}): Ban => ({
  userId: 'u2',
  displayName: 'Bob',
  title: 'Time out',
  description: 'Take a break.',
  bannedAt: '2026-11-16T10:00:00.000Z',
  until: '2026-11-16T12:00:00.000Z',
  bannedBy: 'Boss',
  ...over,
});

const renderCoins = () =>
  render(
    <SessionContext.Provider value={{ session, logout }}>
      <AdminCoins />
    </SessionContext.Provider>,
  );

/** Finds the players and chooses Bob, then switches to banning. */
async function chooseBobToBan(user: ReturnType<typeof userEvent.setup>) {
  renderCoins();
  await user.type(screen.getByLabelText(/find a player/i), 'bo');
  await user.click(screen.getByRole('button', { name: /^search$/i }));
  await user.click(await screen.findByRole('button', { name: /choose bob/i }));
  await user.click(screen.getByRole('button', { name: 'Ban' }));
}
const field = (label: RegExp) => screen.getByLabelText(label);
async function fill(user: ReturnType<typeof userEvent.setup>, title: string, description: string, amount: string, unit?: string) {
  await user.type(field(/^title/i), title);
  await user.type(field(/^description/i), description);
  await user.type(screen.getByRole('textbox', { name: /^how long$/i }), amount);
  if (unit) await user.selectOptions(screen.getByRole('combobox', { name: /how long/i }), unit);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.searchUsers).mockResolvedValue({ users: [bob, ada], truncated: false });
  vi.mocked(api.listBans).mockResolvedValue({ bans: [] });
});
afterEach(() => cleanup());

describe('the two buttons that switch between coins and bans', () => {
  it('start on giving and taking coins, with the Ban button ready', () => {
    renderCoins();
    const group = screen.getByRole('group', { name: /what to do with the player/i });
    expect(within(group).getByRole('button', { name: 'Give or take coins' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Ban' })).toHaveAttribute('aria-pressed', 'false');
    expect(api.listBans).not.toHaveBeenCalled(); // no need to look at bans until asked
  });

  it('share one search, so the player found for coins is still there for a ban', async () => {
    const user = userEvent.setup();
    renderCoins();
    await user.type(screen.getByLabelText(/find a player/i), 'bo');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    await user.click(await screen.findByRole('button', { name: /choose bob/i }));
    expect(screen.getByRole('heading', { name: 'Giving coins to Bob' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    expect(api.searchUsers).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Banning Bob' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Give or take coins' }));
    expect(screen.queryByRole('heading', { name: 'Banning Bob' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give coins' })).toBeInTheDocument();
  });

  it('shows the list of current bans only in ban mode', async () => {
    vi.mocked(api.listBans).mockResolvedValue({ bans: [ban()] });
    const user = userEvent.setup();
    renderCoins();
    expect(screen.queryByRole('heading', { name: 'Current bans' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    expect(await screen.findByRole('heading', { name: 'Current bans' })).toBeInTheDocument();
    expect(await screen.findByText('Time out')).toBeInTheDocument();
  });
});

describe('banning a player', () => {
  it('asks for a title, a description and how long, and gives the length in minutes, hours or days', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    expect(field(/^title/i)).toBeInTheDocument();
    expect(field(/^description/i)).toBeInTheDocument();
    const unit = screen.getByRole('combobox', { name: /how long/i });
    expect(within(unit).getAllByRole('option').map((o) => o.textContent)).toEqual(['minutes', 'hours', 'days']);
  });

  it('asks once more before banning, saying for how long', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'Cheating', 'You edited your coins.', '2', 'days');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    expect(api.banUser).not.toHaveBeenCalled();
    expect(screen.getByText(/ban bob for 2d\? they are cut off straight away/i)).toBeInTheDocument();
  });

  it('bans for the length chosen, in minutes, with the words tidied', async () => {
    vi.mocked(api.banUser).mockResolvedValue({ ban: ban() });
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, '  Cheating ', ' You edited your coins. ', '2', 'hours');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    expect(api.banUser).toHaveBeenCalledWith('admin-token', 'u2', { title: 'Cheating', description: 'You edited your coins.', durationMinutes: 120 });
    expect(await screen.findByRole('status')).toHaveTextContent(/bob is banned until/i);
  });

  it('turns days into minutes', async () => {
    vi.mocked(api.banUser).mockResolvedValue({ ban: ban() });
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '3', 'days');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    expect(api.banUser).toHaveBeenCalledWith('admin-token', 'u2', expect.objectContaining({ durationMinutes: 4320 }));
  });

  it('can be cancelled at the confirmation', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(api.banUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ban Bob' })).toBeInTheDocument();
  });

  it('takes back the confirmation if the form is changed', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.type(field(/^title/i), 'z');
    expect(screen.queryByRole('button', { name: /yes, ban/i })).not.toBeInTheDocument();
  });

  it('clears the form after a ban and loads the list of bans again', async () => {
    vi.mocked(api.banUser).mockResolvedValue({ ban: ban() });
    const user = userEvent.setup();
    await chooseBobToBan(user);
    expect(api.listBans).toHaveBeenCalledTimes(1);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    await screen.findByRole('status');
    expect(field(/^title/i)).toHaveValue('');
    expect(api.listBans).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['no title', '', 'y', '5', /give the ban a title/i],
    ['a blank title', '   ', 'y', '5', /give the ban a title/i],
    ['no description', 'x', '', '5', /say why the player is banned/i],
    ['no length', 'x', 'y', '', /say how long the ban lasts/i],
    ['a length that is not a whole number', 'x', 'y', '1.5', /say how long the ban lasts/i],
    ['a length of zero', 'x', 'y', '0', /say how long the ban lasts/i],
    ['a length with letters', 'x', 'y', '5m', /say how long the ban lasts/i],
  ])('refuses %s, and says what is missing', async (_what, title, description, amount, message) => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    if (title) await user.type(field(/^title/i), title);
    if (description) await user.type(field(/^description/i), description);
    if (amount) await user.type(screen.getByRole('textbox', { name: /^how long$/i }), amount);
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(api.banUser).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /yes, ban/i })).not.toBeInTheDocument();
  });

  it('refuses a ban of more than ten years', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '3651', 'days');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/up to 10 years/i);
    expect(api.banUser).not.toHaveBeenCalled();
  });

  it('allows exactly ten years', async () => {
    vi.mocked(api.banUser).mockResolvedValue({ ban: ban() });
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '3650', 'days');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    expect(api.banUser).toHaveBeenCalledWith('admin-token', 'u2', expect.objectContaining({ durationMinutes: 5_256_000 }));
  });

  it('cannot take more than 60 characters of title or 500 of description', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    expect(field(/^title/i)).toHaveAttribute('maxlength', '60');
    expect(field(/^description/i)).toHaveAttribute('maxlength', '500');
  });

  it('explains it when an admin cannot be banned', async () => {
    vi.mocked(api.banUser).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/bob cannot be banned. admins can never be banned/i);
  });

  it('explains it when the player no longer exists, and when it fails some other way', async () => {
    vi.mocked(api.banUser).mockRejectedValueOnce(new ApiError(404, 'USER_NOT_FOUND', 'no'));
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/bob no longer exists/i);
    vi.mocked(api.banUser).mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not ban/i));
  });

  it('logs the admin out when the login has run out', async () => {
    vi.mocked(api.banUser).mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'no'));
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await fill(user, 'x', 'y', '5', 'minutes');
    await user.click(screen.getByRole('button', { name: 'Ban Bob' }));
    await user.click(screen.getByRole('button', { name: /yes, ban/i }));
    await vi.waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('starts with an empty form for each player', async () => {
    const user = userEvent.setup();
    await chooseBobToBan(user);
    await user.type(field(/^title/i), 'half done');
    await user.click(screen.getByRole('button', { name: /choose ada/i }));
    expect(screen.getByRole('heading', { name: 'Banning Ada' })).toBeInTheDocument();
    expect(field(/^title/i)).toHaveValue('');
  });
});

describe('the list of current bans', () => {
  it('shows who is banned, the title and when it ends, each with an Unban button', async () => {
    vi.mocked(api.listBans).mockResolvedValue({ bans: [ban(), ban({ userId: 'u1', displayName: 'Ada', title: 'Rude' })] });
    const user = userEvent.setup();
    renderCoins();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    const list = await screen.findByRole('region', { name: 'Current bans' });
    expect(await within(list).findByText('Bob')).toBeInTheDocument();
    expect(within(list).getByText('Rude')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Unban Bob' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Unban Ada' })).toBeInTheDocument();
  });

  it('says so when nobody is banned', async () => {
    const user = userEvent.setup();
    renderCoins();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    expect(await screen.findByText(/nobody is banned right now/i)).toBeInTheDocument();
  });

  it('lifts a ban and takes it off the list', async () => {
    vi.mocked(api.listBans).mockResolvedValue({ bans: [ban()] });
    vi.mocked(api.liftBan).mockResolvedValue({ lifted: true });
    const user = userEvent.setup();
    renderCoins();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    await user.click(await screen.findByRole('button', { name: 'Unban Bob' }));
    expect(api.liftBan).toHaveBeenCalledWith('admin-token', 'u2');
    expect(await screen.findByRole('status')).toHaveTextContent(/bob is no longer banned/i);
    expect(screen.queryByRole('button', { name: 'Unban Bob' })).not.toBeInTheDocument();
  });

  it('keeps the ban on the list and says so when lifting fails', async () => {
    vi.mocked(api.listBans).mockResolvedValue({ bans: [ban()] });
    vi.mocked(api.liftBan).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const user = userEvent.setup();
    renderCoins();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    await user.click(await screen.findByRole('button', { name: 'Unban Bob' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not lift the ban/i);
    expect(screen.getByRole('button', { name: 'Unban Bob' })).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded', async () => {
    vi.mocked(api.listBans).mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'boom'));
    const user = userEvent.setup();
    renderCoins();
    await user.click(screen.getByRole('button', { name: 'Ban' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the bans/i);
  });
});
