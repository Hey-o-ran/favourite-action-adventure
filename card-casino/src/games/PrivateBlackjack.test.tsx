// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import * as api from '../api';
import { BlackjackModes } from './PrivateBlackjack';

const code = 'a'.repeat(32);
const room: api.PrivateBlackjackRoom = { code, host: 'host', guest: 'guest', mode: 'competitive', expiresAt: 4_000_000_000, version: 1 };
const activeRoom: api.PrivateBlackjackRoom = {
  ...room,
  roundNumber: 1,
  scores: [0, 0],
  round: {
    dealer: [{ rank: 'K', suit: 'spades' }],
    players: [
      [{ cards: [{ rank: '5', suit: 'clubs' }, { rank: '5', suit: 'hearts' }] }],
      [{ cards: [{ rank: '7', suit: 'diamonds' }] }],
    ],
    turn: 0, hand: 0, over: false,
  },
};

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

/** Opens the private blackjack lobby. `wallet` counts how often the balance was saved and loaded again. */
function open(userId = 'host', balance = 1000) {
  const wallet = { flush: vi.fn().mockResolvedValue(undefined), reload: vi.fn().mockResolvedValue(undefined) };
  const view = render(<BlackjackModes userId={userId} token="test-token" active onUnauthorized={vi.fn()}
    balance={balance} flushBalance={wallet.flush} reloadBalance={wallet.reload}>
    <p>Practice table</p>
  </BlackjackModes>);
  fireEvent.click(screen.getByRole('button', { name: 'Private blackjack' }));
  return { ...view, wallet };
}

test('creates a room and submits the visible match version to the server', async () => {
  const create = vi.spyOn(api, 'createPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, version: undefined });
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(room);
  const play = vi.spyOn(api, 'playPrivateBlackjack').mockResolvedValue({ ...activeRoom, version: 2 });

  open();
  expect(screen.getByText('Practice table')).not.toBeVisible();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  expect(create).toHaveBeenCalledWith('test-token', 'competitive', 0);
  expect(await screen.findByText(code)).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: 'Start round' }));
  expect(play).toHaveBeenCalledWith('test-token', code, 1, 'start');
  expect(await screen.findByText('Your turn.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Split' }));
  expect(play).toHaveBeenLastCalledWith('test-token', code, 2, 'split');
});

test('normalises invite codes and restores a match for the same signed-in player', async () => {
  const fetchRoom = vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  const join = vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(room);
  const first = open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: ' ' + code.toUpperCase() + ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  await waitFor(() => expect(join).toHaveBeenCalledWith('test-token', code));
  expect(await screen.findByText('Other player’s turn.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Hit' })).not.toBeInTheDocument();

  const reconnect = vi.fn();
  const back = screen.getByRole('button', { name: 'Leave room' });
  expect(back).toBeVisible();
  expect(sessionStorage.getItem('private-blackjack:guest')).toBe(code);
  first.unmount();
  const reloaded = render(<BlackjackModes userId="guest" token="test-token" active onUnauthorized={reconnect}
    balance={1000} flushBalance={vi.fn().mockResolvedValue(undefined)} reloadBalance={vi.fn().mockResolvedValue(undefined)}>
    <p>Second practice table</p>
  </BlackjackModes>);
  await waitFor(() => expect(fetchRoom).toHaveBeenCalledTimes(2));
  expect(await reloaded.findByText('Other player’s turn.')).toBeVisible();
});

test('offers a stake only in a ten-round match, and only the stakes the balance can cover', () => {
  open('host', 120);
  expect(screen.queryByLabelText('Stake (each player)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  const picker = screen.getByLabelText('Stake (each player)');
  const option = (name: string) => screen.getByRole('option', { name }) as HTMLOptionElement;
  expect(option('Free play, no stake').disabled).toBe(false);
  expect(option('100 coins each').disabled).toBe(false);
  expect(option('500 coins each').disabled).toBe(true);
  expect(picker).toBeVisible();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'dealer' } });
  expect(screen.queryByLabelText('Stake (each player)')).not.toBeInTheDocument();
});

test('creates a staked room after saving the balance, then loads the balance again', async () => {
  const create = vi.spyOn(api, 'createPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, version: undefined, stake: 100 });
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, stake: 100 });
  const { wallet } = open();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.change(screen.getByLabelText('Stake (each player)'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('test-token', 'competitive', 100));
  expect(wallet.flush.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  expect(await screen.findByText('Stake: 100 coins each, pot 200 coins')).toBeVisible();
  await waitFor(() => expect(wallet.reload).toHaveBeenCalledTimes(1));
});

test('does not send a stake for a one-round room, even after choosing one', async () => {
  const create = vi.spyOn(api, 'createPrivateBlackjackRoom').mockResolvedValue({ ...room, mode: 'dealer', guest: undefined });
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue({ ...room, mode: 'dealer', guest: undefined });
  const { wallet } = open();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.change(screen.getByLabelText('Stake (each player)'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'dealer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('test-token', 'dealer', 0));
  expect(wallet.reload).not.toHaveBeenCalled();
});

test('tells the player when they cannot cover the stake', async () => {
  vi.spyOn(api, 'createPrivateBlackjackRoom').mockRejectedValue(new api.ApiError(409, 'NOT_ENOUGH_COINS', 'Not enough coins'));
  open();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.change(screen.getByLabelText('Stake (each player)'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  expect(await screen.findByText('You don’t have enough practice coins for that stake.')).toBeVisible();
});

test('leaving before the first round tells the server and goes back to the lobby without a warning', async () => {
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, stake: 50 });
  vi.spyOn(api, 'createPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, stake: 50 });
  const leave = vi.spyOn(api, 'leavePrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, stake: 50, settlement: { outcome: 'refunded' } });
  const { wallet } = open();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.change(screen.getByLabelText('Stake (each player)'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave room' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await waitFor(() => expect(leave).toHaveBeenCalledWith('test-token', code));
  expect(await screen.findByRole('button', { name: 'Create room' })).toBeVisible();
  expect(sessionStorage.getItem('private-blackjack:host')).toBeNull();
  await waitFor(() => expect(wallet.reload).toHaveBeenCalled());
});

test('leaving mid-match warns that it forfeits the pot, and only leaves once confirmed', async () => {
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue({ ...activeRoom, stake: 100 });
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue({ ...activeRoom, stake: 100 });
  const leave = vi.spyOn(api, 'leavePrivateBlackjackRoom').mockResolvedValue({ ...activeRoom, stake: 100, settlement: { outcome: 'forfeit', winner: 'host' } });
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave room' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Leaving now forfeits the match, and the other player takes the whole pot.');
  expect(leave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(leave).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Leave room' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave and forfeit' }));
  await waitFor(() => expect(leave).toHaveBeenCalledWith('test-token', code));
  expect(await screen.findByRole('button', { name: 'Create room' })).toBeVisible();
});

test('leaving a room the server no longer has goes back to the lobby instead of keeping the player in it', async () => {
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  const leave = vi.spyOn(api, 'leavePrivateBlackjackRoom').mockRejectedValue(new api.ApiError(404, 'UNKNOWN', 'Not Found'));
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Leave room' }));
  fireEvent.click(screen.getByRole('button', { name: 'Leave and forfeit' }));
  await waitFor(() => expect(leave).toHaveBeenCalledWith('test-token', code));
  expect(await screen.findByRole('button', { name: 'Create room' })).toBeVisible();
  expect(sessionStorage.getItem('private-blackjack:guest')).toBeNull();
});

test('shows the claim button only while the other player holds the move', async () => {
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  // The host holds the move (turn 0), so the guest may claim.
  expect(await screen.findByRole('button', { name: 'Claim the win' })).toBeEnabled();
  cleanup();
  sessionStorage.clear();

  const mine = { ...activeRoom, round: { ...activeRoom.round!, turn: 1 as const } };
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(mine);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(mine);
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  expect(await screen.findByText('Your turn.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Claim the win' })).not.toBeInTheDocument();
});

test('a claim that comes too early counts down to when it will work', async () => {
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(activeRoom);
  const claim = vi.spyOn(api, 'claimPrivateBlackjackForfeit')
    .mockRejectedValue(new api.ApiError(409, 'TOO_EARLY', 'Your opponent still has time to move.', undefined, { claimableAt: Date.now() + 90_000 }));
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Claim the win' }));
  expect(await screen.findByText('The other player still has time to move. You can claim in 1:30.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Claim the win' })).toBeDisabled();
  expect(claim).toHaveBeenCalledTimes(1);
});

test('counts down to the deadline the room response carries, without a failed claim', async () => {
  const waiting = { ...activeRoom, awaiting: 'host', claimableAt: Date.now() + 90_000 };
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(waiting);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(waiting);
  const claim = vi.spyOn(api, 'claimPrivateBlackjackForfeit');
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  expect(await screen.findByText('The other player still has time to move. You can claim in 1:30.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Claim the win' })).toBeDisabled();
  expect(claim).not.toHaveBeenCalled();
});

test('trusts the server about whose move it is, and offers the claim once the deadline has passed', async () => {
  // The board says it is the host's turn, but the server says the guest must act: no claim for the guest.
  const mine = { ...activeRoom, awaiting: 'guest', claimableAt: Date.now() + 90_000 };
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(mine);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(mine);
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  expect(await screen.findByText('Other player’s turn.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Claim the win' })).not.toBeInTheDocument();
  cleanup();
  sessionStorage.clear();

  const overdue = { ...activeRoom, awaiting: 'host', claimableAt: Date.now() - 1000 };
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(overdue);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(overdue);
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  expect(await screen.findByRole('button', { name: 'Claim the win' })).toBeEnabled();
});

test('shows the mode and stake of an invite before joining, without joining', async () => {
  const preview = vi.spyOn(api, 'previewPrivateBlackjackRoom')
    .mockResolvedValue({ code, mode: 'competitive', stake: 100, expiresAt: 4_000_000_000, joined: false });
  const join = vi.spyOn(api, 'joinPrivateBlackjackRoom');
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: ' ' + code.toUpperCase() + ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check the room' }));
  expect(await screen.findByText(/Stake: 100 coins each, pot 200 coins/)).toBeVisible();
  expect(preview).toHaveBeenCalledWith('test-token', code);
  expect(join).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Join room' })).toBeEnabled();
  // Typing another code drops what was shown for the first one.
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'b'.repeat(32) } });
  expect(screen.queryByText(/Stake: 100 coins each/)).not.toBeInTheDocument();
});

test('does not let a player join an invite whose stake they cannot cover', async () => {
  vi.spyOn(api, 'previewPrivateBlackjackRoom')
    .mockResolvedValue({ code, mode: 'competitive', stake: 500, expiresAt: 4_000_000_000, joined: false });
  open('guest', 100);
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Check the room' }));
  expect(await screen.findByText(/You don’t have enough practice coins/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Join room' })).toBeDisabled();
});

test('says the room is unavailable when the invite cannot be previewed', async () => {
  vi.spyOn(api, 'previewPrivateBlackjackRoom').mockRejectedValue(new api.ApiError(404, 'NOT_FOUND', 'Room unavailable.'));
  open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Check the room' }));
  expect(await screen.findByText(/Room unavailable/)).toBeVisible();
});

test('a claim that works shows the result and loads the balance again, once however often the room is polled', async () => {
  const live: api.PrivateBlackjackRoom = { ...activeRoom, stake: 100 };
  const settled: api.PrivateBlackjackRoom = { ...live, version: 2, settlement: { outcome: 'forfeit', winner: 'guest' } };
  // The room keeps being fetched as it was before the claim: the older version must not win over the claim's result.
  const fetchRoom = vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(live);
  vi.spyOn(api, 'joinPrivateBlackjackRoom').mockResolvedValue(live);
  const claim = vi.spyOn(api, 'claimPrivateBlackjackForfeit').mockResolvedValue(settled);
  const { wallet } = open('guest');
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Claim the win' }));
  await waitFor(() => expect(claim).toHaveBeenCalledWith('test-token', code));
  expect(await screen.findByText('The other player forfeited. You win. You received the pot: 200 coins.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Claim the win' })).not.toBeInTheDocument();
  // One reload for taking the stake when joining, and one for the settlement. Fetching the room again adds none.
  await waitFor(() => expect(wallet.reload).toHaveBeenCalledTimes(2));
  const fetches = fetchRoom.mock.calls.length;
  await waitFor(() => expect(fetchRoom.mock.calls.length).toBeGreaterThan(fetches), { timeout: 4000 });
  expect(wallet.reload).toHaveBeenCalledTimes(2);
});

test('says what happened to the stakes when the match ends', async () => {
  const cases: [api.PrivateBlackjackSettlement, string][] = [
    [{ outcome: 'won', winner: 'host' }, 'You won the match. You received the pot: 200 coins.'],
    [{ outcome: 'won', winner: 'guest' }, 'The other player won the match. You lost your stake of 100 coins.'],
    [{ outcome: 'split' }, 'The match was a tie. Your stake of 100 coins was returned.'],
    [{ outcome: 'forfeit', winner: 'guest' }, 'You forfeited the match. You lost your stake of 100 coins.'],
  ];
  for (const [settlement, text] of cases) {
    sessionStorage.setItem('private-blackjack:host', code);
    vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue({ ...activeRoom, complete: true, stake: 100, settlement });
    open('host');
    expect(await screen.findByText(text)).toBeVisible();
    cleanup();
    sessionStorage.clear();
  }
});
