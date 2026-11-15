// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { defaultsOf, loadSettings, sanitize, saveSettings, useGameSettings, type SettingsSchema } from './gameSettings';

const schema: SettingsSchema = {
  gameId: 'test-game',
  groups: [
    {
      title: 'settings.gin.group.bot',
      settings: [
        {
          kind: 'choice',
          id: 'level',
          label: 'settings.gin.difficulty',
          default: 'normal',
          options: [
            { value: 'easy', label: 'settings.gin.difficulty.easy' },
            { value: 'normal', label: 'settings.gin.difficulty.normal' },
            { value: 'hard', label: 'settings.gin.difficulty.hard' },
          ],
        },
      ],
    },
    { title: 'settings.gin.group.modifiers', settings: [{ kind: 'toggle', id: 'wild', label: 'settings.gin.double', default: false }] },
  ],
};
const other: SettingsSchema = { ...schema, gameId: 'other-game' };

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('game settings values', () => {
  it('start at the defaults, across every group', () => {
    expect(defaultsOf(schema)).toEqual({ level: 'normal', wild: false });
    expect(loadSettings(schema)).toEqual({ level: 'normal', wild: false });
  });

  it('keep valid saved values and fill in the rest', () => {
    expect(sanitize(schema, { level: 'hard' })).toEqual({ level: 'hard', wild: false });
    expect(sanitize(schema, { wild: true })).toEqual({ level: 'normal', wild: true });
  });

  it('ignore a choice that is not one of the options, or the wrong kind of value', () => {
    expect(sanitize(schema, { level: 'impossible', wild: 'yes' })).toEqual({ level: 'normal', wild: false });
    expect(sanitize(schema, { level: 3, wild: 1 })).toEqual({ level: 'normal', wild: false });
    expect(sanitize(schema, { level: null, wild: null })).toEqual({ level: 'normal', wild: false });
  });

  it('drop settings the game does not have, and survive junk', () => {
    expect(sanitize(schema, { level: 'easy', cheat: true })).toEqual({ level: 'easy', wild: false });
    for (const junk of [null, undefined, 'text', 42, [], true]) expect(sanitize(schema, junk)).toEqual({ level: 'normal', wild: false });
  });

  it('do not let a saved value reach into the prototype', () => {
    expect(sanitize(schema, JSON.parse('{"__proto__":{"level":"hard"}}'))).toEqual({ level: 'normal', wild: false });
    expect(sanitize(schema, { constructor: 'easy' })).toEqual({ level: 'normal', wild: false });
  });
});

describe('saving settings', () => {
  it('remembers them, apart for each game', () => {
    saveSettings(schema, { level: 'hard', wild: true });
    expect(loadSettings(schema)).toEqual({ level: 'hard', wild: true });
    expect(loadSettings(other)).toEqual({ level: 'normal', wild: false });
  });

  it('falls back to the defaults for a save that is not valid JSON, or has since become invalid', () => {
    window.localStorage.setItem('card-casino.settings.test-game', '{not json');
    expect(loadSettings(schema)).toEqual({ level: 'normal', wild: false });
    window.localStorage.setItem('card-casino.settings.test-game', JSON.stringify({ level: 'retired option', wild: true }));
    expect(loadSettings(schema)).toEqual({ level: 'normal', wild: true });
  });

  it('carries on when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadSettings(schema)).toEqual({ level: 'normal', wild: false });
    expect(() => saveSettings(schema, { level: 'easy', wild: false })).not.toThrow();
  });
});

describe('using settings in a game', () => {
  it('starts from what was saved, changes one setting at a time, and remembers the change', () => {
    saveSettings(schema, { level: 'easy', wild: false });
    const { result } = renderHook(() => useGameSettings(schema));
    expect(result.current.values).toEqual({ level: 'easy', wild: false });

    act(() => result.current.set('wild', true));
    expect(result.current.values).toEqual({ level: 'easy', wild: true });
    expect(loadSettings(schema)).toEqual({ level: 'easy', wild: true });

    // A fresh visit picks the change up.
    const next = renderHook(() => useGameSettings(schema));
    expect(next.result.current.values).toEqual({ level: 'easy', wild: true });
  });

  it('refuses a value that is not allowed, keeping what it had', () => {
    const { result } = renderHook(() => useGameSettings(schema));
    act(() => result.current.set('level', 'hard'));
    act(() => result.current.set('level', 'ludicrous'));
    expect(result.current.values.level).toBe('hard');
    act(() => result.current.set('wild', 'maybe'));
    expect(result.current.values.wild).toBe(false);
  });

  it('goes back to the defaults on reset, and remembers that too', () => {
    const { result } = renderHook(() => useGameSettings(schema));
    act(() => result.current.set('level', 'hard'));
    act(() => result.current.set('wild', true));
    act(() => result.current.reset());
    expect(result.current.values).toEqual({ level: 'normal', wild: false });
    expect(loadSettings(schema)).toEqual({ level: 'normal', wild: false });
  });
});
