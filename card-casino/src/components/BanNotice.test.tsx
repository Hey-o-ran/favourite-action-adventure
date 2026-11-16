// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BanDetails } from '../api';
import { getBalance, setBannedHandler } from '../api';
import { SessionContext, type Session } from '../session';
import { BanGate } from './BanGate';
import { BanNotice } from './BanNotice';

const NOW = new Date('2026-11-16T10:00:00Z');
const ban = (minutesLeft: number): BanDetails => ({
  title: 'Time out',
  description: 'You edited your coins.\nPlease come back and play fair.',
  until: new Date(NOW.getTime() + minutesLeft * 60_000).toISOString(),
});

beforeEach(() => vi.useFakeTimers({ now: NOW }));
afterEach(() => {
  cleanup();
  setBannedHandler(null);
  vi.useRealTimers();
});

describe('the ban notice', () => {
  it('shows the title and description the admin wrote, as plain text', () => {
    render(<BanNotice ban={{ ...ban(60), title: '<b>Hello</b>' }} />);
    expect(screen.getByRole('heading', { name: 'You are banned' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '<b>Hello</b>' })).toBeInTheDocument(); // not turned into a tag
    expect(document.querySelector('.ban-description')).toHaveTextContent('You edited your coins.');
    expect(document.querySelector('.ban-description')).toHaveTextContent('Please come back and play fair.');
  });

  it('says how long is left, and when it ends', () => {
    render(<BanNotice ban={ban(125)} />);
    expect(screen.getByText(/the ban ends in 2h 5m/i)).toBeInTheDocument();
    expect(screen.getByText(/it ends on/i)).toBeInTheDocument();
  });

  it('counts the time down as it passes', () => {
    render(<BanNotice ban={ban(3)} />);
    expect(screen.getByText(/ends in 3m/i)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(screen.getByText(/ends in 2m/i)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(90_000));
    expect(screen.getByText(/ends in 30s/i)).toBeInTheDocument();
  });

  it('says so, and offers to carry on, when the time is up', () => {
    const onRetry = vi.fn();
    render(<BanNotice ban={ban(1)} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: /play again/i })).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(61_000));
    expect(screen.getByText(/your ban is over/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /play again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a ban that has already run out as over', () => {
    render(<BanNotice ban={ban(-5)} onRetry={() => {}} />);
    expect(screen.getByText(/your ban is over/i)).toBeInTheDocument();
  });

  it('offers to log out, or to go back to the login, only where it makes sense', () => {
    const onLogout = vi.fn();
    const onBack = vi.fn();
    const { unmount } = render(<BanNotice ban={ban(60)} onLogout={onLogout} />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(onLogout).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /back to login/i })).not.toBeInTheDocument();
    unmount();
    render(<BanNotice ban={ban(60)} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('is announced to a screen reader', () => {
    render(<BanNotice ban={ban(60)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Time out');
  });
});

describe('the ban gate', () => {
  const session: Session = { idToken: 'tok', expiresAt: Date.now() + 3_600_000, user: { userId: 'u1', email: 'a@b.c', displayName: 'Ada', isAdmin: false } };
  const logout = vi.fn();
  const renderGate = () =>
    render(
      <SessionContext.Provider value={{ session, logout }}>
        <BanGate>
          <p>The casino floor</p>
        </BanGate>
      </SessionContext.Provider>,
    );
  /** The server turns a request away, as it does for a banned player. */
  const serverRefuses = async (status: number, code: string, details?: object) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: 'no', ...(details && { details }) } }), { status })));
    await act(async () => {
      await getBalance('tok').catch(() => undefined);
    });
  };

  beforeEach(() => logout.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the casino until the server turns a request away because the player is banned', async () => {
    renderGate();
    expect(screen.getByText('The casino floor')).toBeInTheDocument();
    await serverRefuses(403, 'BANNED', ban(90));
    expect(screen.queryByText('The casino floor')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time out' })).toBeInTheDocument();
    expect(screen.getByText(/the ban ends in 1h 30m/i)).toBeInTheDocument();
  });

  it('shows it whatever the player was doing, because any request can be refused', async () => {
    renderGate();
    await serverRefuses(403, 'BANNED', ban(5));
    expect(screen.getByRole('heading', { name: 'You are banned' })).toBeInTheDocument();
  });

  it('lets the player log out from it', async () => {
    renderGate();
    await serverRefuses(403, 'BANNED', ban(60));
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('gives the casino back when the time is up and they choose to play again', async () => {
    renderGate();
    await serverRefuses(403, 'BANNED', ban(1));
    act(() => void vi.advanceTimersByTime(61_000));
    fireEvent.click(screen.getByRole('button', { name: /play again/i }));
    expect(screen.getByText('The casino floor')).toBeInTheDocument();
  });

  it('ignores other refusals, which are not bans', async () => {
    renderGate();
    await serverRefuses(403, 'FORBIDDEN');
    await serverRefuses(401, 'UNAUTHORIZED');
    await serverRefuses(500, 'INTERNAL_ERROR');
    expect(screen.getByText('The casino floor')).toBeInTheDocument();
  });

  it('ignores a ban with nothing to show', async () => {
    renderGate();
    await serverRefuses(403, 'BANNED');
    expect(screen.getByText('The casino floor')).toBeInTheDocument();
  });

  it('stops listening when it is closed', async () => {
    const view = renderGate();
    view.unmount();
    await expect(serverRefuses(403, 'BANNED', ban(60))).resolves.toBeUndefined();
  });
});
