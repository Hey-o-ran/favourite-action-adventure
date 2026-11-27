// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getPlayerProfile } from '../api';
import { SessionContext, type Session } from '../session';
import { OpenPlayerProfile, PlayerName, PlayerProfile } from './PlayerProfile';

vi.mock('../api', async (original) => ({
  ...await original<typeof import('../api')>(),
  getPlayerProfile: vi.fn(),
}));

const session: Session = {
  idToken: 'token',
  expiresAt: 0,
  user: { userId: 'viewer', email: 'viewer@example.com', displayName: 'Viewer', isAdmin: false },
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('player profiles', () => {
  it('requests a profile using the signed-in session and shows unknown last seen', async () => {
    vi.mocked(getPlayerProfile).mockResolvedValue({
      displayName: 'Player',
      createdAt: '2025-01-01T12:00:00Z',
      lastSeenAt: null,
    });
    const onBack = vi.fn();
    render(<SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <PlayerProfile userId="player" onBack={onBack} />
    </SessionContext.Provider>);
    expect(await screen.findByRole('heading', { name: 'Player' })).toBeVisible();
    expect(screen.getByText('Unknown')).toBeVisible();
    expect(getPlayerProfile).toHaveBeenCalledWith('token', 'player');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows an unavailable profile as player not found', async () => {
    vi.mocked(getPlayerProfile).mockRejectedValue(new ApiError(404, 'USER_NOT_FOUND', 'No such user'));
    render(<SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <PlayerProfile userId="unavailable" onBack={vi.fn()} />
    </SessionContext.Provider>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Player not found');
  });

  it('opens a linked name by ID and displays names from older responses as text', () => {
    const open = vi.fn();
    render(<OpenPlayerProfile.Provider value={open}>
      <PlayerName userId="stable-id" name="Linked player" />
      <PlayerName name="Legacy player" />
    </OpenPlayerProfile.Provider>);
    fireEvent.click(screen.getByRole('button', { name: 'Linked player' }));
    expect(open).toHaveBeenCalledWith('stable-id');
    expect(screen.getByText('Legacy player')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Legacy player' })).toBeNull();
  });
});
