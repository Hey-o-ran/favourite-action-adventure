// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearProtection,
  isLive,
  loadProtection,
  loadSeen,
  protectedReturn,
  saveProtection,
  saveSeen,
  savedBy,
} from './abuse';
import type { AbuseEvent } from './api';

beforeEach(() => window.localStorage.clear());

describe('unloseable payouts', () => {
  it('pays back at least the stake, so a loss costs nothing', () => {
    expect(protectedReturn(100, 0)).toBe(100);
  });

  it('tops up a partial return to the stake', () => {
    expect(protectedReturn(100, 40)).toBe(100);
  });

  it('leaves a win or a push alone', () => {
    expect(protectedReturn(100, 100)).toBe(100);
    expect(protectedReturn(100, 250)).toBe(250);
  });

  it('works out how much protection saved', () => {
    expect(savedBy(100, 0)).toBe(100);
    expect(savedBy(100, 40)).toBe(60);
    expect(savedBy(100, 100)).toBe(0);
    expect(savedBy(100, 250)).toBe(0); // winning saves nothing, and is never negative
  });
});

describe('whether an event is still on', () => {
  const event = (expiresAt: string): AbuseEvent => ({
    eventId: 'e1',
    type: 'FREE_COINS',
    title: 'ADMIN ABUSE',
    message: 'Everyone gets 1,000 coins!',
    amount: 1000,
    startedAt: '2026-11-13T10:00:00.000Z',
    expiresAt,
  });
  const end = '2026-11-13T10:10:00.000Z';

  it('is on before its end time', () => {
    expect(isLive(event(end), Date.parse('2026-11-13T10:09:59.999Z'))).toBe(true);
  });

  it('is over at its end time, and after', () => {
    expect(isLive(event(end), Date.parse(end))).toBe(false);
    expect(isLive(event(end), Date.parse('2026-11-13T10:30:00.000Z'))).toBe(false);
  });
});

describe('remembering protection', () => {
  it('saves and loads it for a player', () => {
    saveProtection('u1', { eventId: 'e1' });
    expect(loadProtection('u1')).toEqual({ eventId: 'e1' });
  });

  it('keeps each player separate', () => {
    saveProtection('u1', { eventId: 'e1' });
    expect(loadProtection('u2')).toBeNull();
  });

  it('forgets it once used', () => {
    saveProtection('u1', { eventId: 'e1' });
    clearProtection('u1');
    expect(loadProtection('u1')).toBeNull();
  });

  it('ignores damaged storage', () => {
    window.localStorage.setItem('card-casino.abuse.protection.u1', '{not json');
    expect(loadProtection('u1')).toBeNull();
    window.localStorage.setItem('card-casino.abuse.protection.u1', JSON.stringify({ eventId: 42 }));
    expect(loadProtection('u1')).toBeNull();
  });

  it('carries on without storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveProtection('u1', { eventId: 'e1' })).not.toThrow();
    spy.mockRestore();
  });
});

describe('remembering which events were handled', () => {
  it('saves and loads the ids per player', () => {
    saveSeen('u1', ['a', 'b']);
    expect(loadSeen('u1')).toEqual(['a', 'b']);
    expect(loadSeen('u2')).toEqual([]);
  });

  it('keeps only the most recent ones', () => {
    saveSeen('u1', Array.from({ length: 80 }, (_, i) => `e${i}`));
    const seen = loadSeen('u1');
    expect(seen).toHaveLength(50);
    expect(seen[seen.length - 1]).toBe('e79');
  });

  it('ignores damaged storage', () => {
    window.localStorage.setItem('card-casino.abuse.seen.u1', '"nope"');
    expect(loadSeen('u1')).toEqual([]);
    window.localStorage.setItem('card-casino.abuse.seen.u1', JSON.stringify(['a', 7, null, 'b']));
    expect(loadSeen('u1')).toEqual(['a', 'b']);
  });
});
