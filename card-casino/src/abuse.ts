import type { AbuseEvent } from './api';

/*
 * Helpers for the "admin abuse" events. The events themselves come from the server; these keep track of
 * what this player has already handled and whether their next game is protected.
 */

/**
 * What an unloseable game pays back. The player gets at least what they staked, so a loss (or a partial
 * return) costs them nothing, and a win pays out as normal.
 */
export const protectedReturn = (staked: number, returned: number): number => Math.max(staked, returned);

/** How much protection actually saved the player: the coins on top of what the game paid. */
export const savedBy = (staked: number, returned: number): number => Math.max(0, staked - returned);

/** Whether an event is still on, by the player's own clock. */
export const isLive = (event: AbuseEvent, now: number = Date.now()): boolean => Date.parse(event.expiresAt) > now;

/** The protection a player is carrying until their next game ends. */
export interface Protection {
  /** The event that gave it. */
  eventId: string;
}

const protectionKey = (userId: string) => `card-casino.abuse.protection.${userId}`;
const seenKey = (userId: string) => `card-casino.abuse.seen.${userId}`;

/** Storage can be blocked, so every read and write is allowed to fail quietly. */
function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to do: the effect still works for this page load.
  }
}
function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}

export function loadProtection(userId: string): Protection | null {
  const value = read(protectionKey(userId)) as Protection | null;
  return value && typeof value.eventId === 'string' ? { eventId: value.eventId } : null;
}
export const saveProtection = (userId: string, protection: Protection): void => write(protectionKey(userId), protection);
export const clearProtection = (userId: string): void => remove(protectionKey(userId));

/** How many events to remember. Events are short, so a long tail is never needed. */
const MAX_SEEN = 50;

/** The ids of events this player has already claimed or been told were already claimed. */
export function loadSeen(userId: string): string[] {
  const value = read(seenKey(userId));
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}
export function saveSeen(userId: string, ids: readonly string[]): void {
  write(seenKey(userId), ids.slice(-MAX_SEEN));
}
