import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { enGB, type MessageKey } from './en-GB';
import { zhCN } from './zh-CN';

export type { MessageKey };

export type Language = 'en-GB' | 'zh-CN';

/** The languages on offer. Each is named in its own language, so a player can always find theirs. */
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'zh-CN', label: '简体中文' },
];

export const STORAGE_KEY = 'card-casino.language';

const MESSAGES: Record<Language, Record<MessageKey, string>> = { 'en-GB': enGB, 'zh-CN': zhCN };

export type Values = Record<string, string | number>;

/** Numbers are written the same way in both languages: 1,234,567. */
export const formatNumber = (n: number) => n.toLocaleString('en-GB');

/** The text for a key in a language, with `{name}` filled in. A value that is not given is left as it is. */
export function translate(lang: Language, key: MessageKey, values: Values = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) return whole;
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}

export type Translate = (key: MessageKey, values?: Values) => string;

const isLanguage = (value: unknown): value is Language => LANGUAGES.some((l) => l.id === value);

/** What the player chose last time, else Chinese for a browser set to Chinese, else British English. */
function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Storage unavailable: fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-GB';
}

/** Like `translate`, for a sentence with something rich inside it (a bold name, say): each {name} becomes the given node. */
export function translateRich(lang: Language, key: MessageKey, parts: Record<string, ReactNode>): ReactNode[] {
  return MESSAGES[lang][key].split(/(\{\w+\})/).map((piece, i) => {
    const name = piece.match(/^\{(\w+)\}$/)?.[1];
    return name !== undefined && parts[name] !== undefined ? <Fragment key={i}>{parts[name]}</Fragment> : piece;
  });
}

export type TranslateRich = (key: MessageKey, parts: Record<string, ReactNode>) => ReactNode[];

/**
 * The words for a fact about a game (a country, "Solo", "Poker"…). The English word is what the filters match on,
 * so it stays as the value, and this gives the word to show. An unknown word is shown as it is.
 */
export function factText(t: Translate, value: string): string {
  const key = `fact.${value}`;
  return key in enGB ? t(key as MessageKey) : value;
}

/** The name of a poker hand ("Full House") in the chosen language. The English name is what the pay table matches on. */
export function handText(t: Translate, name: string): string {
  const key = `hand.${name}`;
  return key in enGB ? t(key as MessageKey) : name;
}

/** A game's name, blurb or history in the chosen language. A game with no translation yet shows its English text. */
export function gameText(t: Translate, id: string, part: 'name' | 'blurb' | 'note', fallback: string): string {
  const key = `game.${id}.${part}`;
  return key in enGB ? t(key as MessageKey) : fallback;
}

export interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translate;
  /** For a sentence with a bold name or the like inside it. */
  tx: TranslateRich;
}

// Without a provider (in tests of a single component) the text is simply British English.
const DEFAULT: I18nValue = {
  lang: 'en-GB',
  setLang: () => {},
  t: (key, values) => translate('en-GB', key, values),
  tx: (key, parts) => translateRich('en-GB', key, parts),
};
const I18nContext = createContext<I18nValue>(DEFAULT);

export const useI18n = () => useContext(I18nContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);

  // Keep the page itself in step: its language (for screen readers and the browser) and its title.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, 'header.title');
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved, but the choice still applies until the page is closed.
    }
  }, []);

  const t = useCallback<Translate>((key, values) => translate(lang, key, values), [lang]);
  const tx = useCallback<TranslateRich>((key, parts) => translateRich(lang, key, parts), [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t, tx }), [lang, setLang, t, tx]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
