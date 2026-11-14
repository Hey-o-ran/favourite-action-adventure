import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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

export interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translate;
}

// Without a provider (in tests of a single component) the text is simply British English.
const DEFAULT: I18nValue = { lang: 'en-GB', setLang: () => {}, t: (key, values) => translate('en-GB', key, values) };
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
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
