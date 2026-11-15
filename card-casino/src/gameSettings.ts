import { useCallback, useState } from 'react';
import type { MessageKey } from './i18n';

/*
 * Settings a game can offer: choices (like a bot's difficulty or a rule variation) and switches (like a modifier).
 * A game describes its settings once, as a schema. The Settings panel, saving and checking of saved values all work
 * from that description, so the next game only has to write its own schema.
 *
 * Settings are remembered on this device, one set per game. A saved value that is no longer one of the choices is
 * ignored and the default is used instead, so old or edited saves can never put a game in a state it can't be in.
 */

export interface ChoiceSetting {
  kind: 'choice';
  id: string;
  label: MessageKey;
  help?: MessageKey;
  options: { value: string; label: MessageKey; help?: MessageKey }[];
  default: string;
}
export interface ToggleSetting {
  kind: 'toggle';
  id: string;
  label: MessageKey;
  help?: MessageKey;
  default: boolean;
}
export type SettingDef = ChoiceSetting | ToggleSetting;

export interface SettingsGroup {
  title: MessageKey;
  settings: SettingDef[];
}
export interface SettingsSchema {
  /** Keeps this game's saved settings apart from every other game's. */
  gameId: string;
  groups: SettingsGroup[];
}

export type SettingValue = string | boolean;
export type SettingValues = Record<string, SettingValue>;

const allSettings = (schema: SettingsSchema) => schema.groups.flatMap((g) => g.settings);
const storageKey = (schema: SettingsSchema) => `card-casino.settings.${schema.gameId}`;

export const defaultsOf = (schema: SettingsSchema): SettingValues =>
  Object.fromEntries(allSettings(schema).map((s) => [s.id, s.default]));

/** Keeps only the values that are valid for this schema, and fills the rest in with defaults. */
export function sanitize(schema: SettingsSchema, raw: unknown): SettingValues {
  const saved = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const values = defaultsOf(schema);
  for (const setting of allSettings(schema)) {
    const value = Object.prototype.hasOwnProperty.call(saved, setting.id) ? saved[setting.id] : undefined;
    if (setting.kind === 'toggle' && typeof value === 'boolean') values[setting.id] = value;
    if (setting.kind === 'choice' && typeof value === 'string' && setting.options.some((o) => o.value === value)) values[setting.id] = value;
  }
  return values;
}

export function loadSettings(schema: SettingsSchema): SettingValues {
  try {
    const text = window.localStorage.getItem(storageKey(schema));
    return sanitize(schema, text ? JSON.parse(text) : undefined);
  } catch {
    // Storage blocked or unreadable: play with the defaults.
    return defaultsOf(schema);
  }
}

export function saveSettings(schema: SettingsSchema, values: SettingValues): void {
  try {
    window.localStorage.setItem(storageKey(schema), JSON.stringify(values));
  } catch {
    // Storage blocked: the settings still last until the page is closed.
  }
}

/** A game's settings, remembered between visits. `set` changes one, and `reset` goes back to the defaults. */
export function useGameSettings(schema: SettingsSchema) {
  const [values, setValues] = useState<SettingValues>(() => loadSettings(schema));

  const set = useCallback(
    (id: string, value: SettingValue) => {
      setValues((current) => {
        const next = sanitize(schema, { ...current, [id]: value });
        // A value the game doesn't allow is ignored, so the setting keeps what it had.
        if (next[id] !== value) return current;
        saveSettings(schema, next);
        return next;
      });
    },
    [schema],
  );

  const reset = useCallback(() => {
    const next = defaultsOf(schema);
    saveSettings(schema, next);
    setValues(next);
  }, [schema]);

  return { values, set, reset };
}
