// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, loadSession, saveSession, type Session } from './session';

const NOW = 1_000_000;
const session = (over: Partial<Session> = {}): Session => ({
  idToken: 'tok',
  expiresAt: NOW + 60_000,
  user: { userId: 'u1', email: 'ada@example.com', displayName: 'Ada', isAdmin: false },
  ...over,
});

beforeEach(() => window.sessionStorage.clear());

describe('session storage', () => {
  it('returns null when nothing is stored', () => {
    expect(loadSession(NOW)).toBeNull();
  });

  it('round-trips a saved session', () => {
    saveSession(session());
    expect(loadSession(NOW)).toEqual(session());
  });

  it('ignores and clears an expired session', () => {
    saveSession(session({ expiresAt: NOW - 1 }));
    expect(loadSession(NOW)).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('ignores corrupt data', () => {
    window.sessionStorage.setItem('card-casino.session', '{not json');
    expect(loadSession(NOW)).toBeNull();
    window.sessionStorage.setItem('card-casino.session', JSON.stringify({ idToken: 'x' }));
    expect(loadSession(NOW)).toBeNull();
  });

  it('clears the session on logout', () => {
    saveSession(session());
    clearSession();
    expect(loadSession(NOW)).toBeNull();
  });
});
