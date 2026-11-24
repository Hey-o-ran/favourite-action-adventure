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

function open(userId = 'host') {
  return render(<BlackjackModes userId={userId} token="test-token" active onUnauthorized={vi.fn()}>
    <p>Practice table</p>
  </BlackjackModes>);
}

test('creates a room and submits the visible match version to the server', async () => {
  const create = vi.spyOn(api, 'createPrivateBlackjackRoom').mockResolvedValue({ ...room, guest: undefined, version: undefined });
  vi.spyOn(api, 'getPrivateBlackjackRoom').mockResolvedValue(room);
  const play = vi.spyOn(api, 'playPrivateBlackjack').mockResolvedValue({ ...activeRoom, version: 2 });

  open();
  fireEvent.click(screen.getByRole('button', { name: 'Private blackjack' }));
  expect(screen.getByText('Practice table')).not.toBeVisible();
  fireEvent.change(screen.getByLabelText('Room mode'), { target: { value: 'competitive' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create room' }));
  expect(create).toHaveBeenCalledWith('test-token', 'competitive');
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
  fireEvent.click(screen.getByRole('button', { name: 'Private blackjack' }));
  fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: ' ' + code.toUpperCase() + ' ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Join room' }));
  expect(join).toHaveBeenCalledWith('test-token', code);
  expect(await screen.findByText('Other player?s turn.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Hit' })).not.toBeInTheDocument();

  const reconnect = vi.fn();
  const back = screen.getByRole('button', { name: 'Back to lobby' });
  expect(back).toBeVisible();
  expect(sessionStorage.getItem('private-blackjack:guest')).toBe(code);
  first.unmount();
  const reloaded = render(<BlackjackModes userId="guest" token="test-token" active onUnauthorized={reconnect}>
    <p>Second practice table</p>
  </BlackjackModes>);
  await waitFor(() => expect(fetchRoom).toHaveBeenCalledTimes(2));
  expect(await reloaded.findByText('Other player?s turn.')).toBeVisible();
});
