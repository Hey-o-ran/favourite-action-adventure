// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LANGUAGES, LanguageProvider, STORAGE_KEY, translate, useI18n } from './i18n';
import { enGB } from './i18n/en-GB';
import { zhCN } from './i18n/zh-CN';
import { App } from './App';
import { WalletProvider } from './wallet';
import { SessionContext, type Session } from './session';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, getBalance: vi.fn(), saveBalance: vi.fn(), listActiveEvents: vi.fn(), getLeaderboard: vi.fn() };
});

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translate', () => {
  it('returns the British English text by default', () => {
    expect(translate('en-GB', 'menu.logout')).toBe('Log out');
  });

  it('returns the Simplified Chinese text', () => {
    expect(translate('zh-CN', 'menu.logout')).toBe(zhCN['menu.logout']);
    expect(zhCN['menu.logout']).not.toBe(enGB['menu.logout']);
  });

  it('fills in values, with big numbers written with commas', () => {
    expect(translate('en-GB', 'header.coins', { amount: 4321 })).toBe('4,321 coins');
    expect(translate('zh-CN', 'header.coins', { amount: 4321 })).toContain('4,321');
  });

  it('leaves text alone when a value is missing, rather than crashing', () => {
    expect(translate('en-GB', 'header.coins', {})).toContain('{amount}');
  });
});

describe('the two languages stay in step', () => {
  const keys = Object.keys(enGB) as (keyof typeof enGB)[];

  it('has a Chinese text for every English one, and no empty text', () => {
    expect(Object.keys(zhCN).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(enGB[key].trim(), key).not.toBe('');
      expect(zhCN[key].trim(), key).not.toBe('');
    }
  });

  it('uses the same {values} in both languages', () => {
    for (const key of keys) expect(placeholders(zhCN[key]), key).toEqual(placeholders(enGB[key]));
  });

  it('offers exactly British English and Simplified Chinese, each named in its own language', () => {
    expect(LANGUAGES.map((l) => [l.id, l.label])).toEqual([
      ['en-GB', 'English (UK)'],
      ['zh-CN', '简体中文'],
    ]);
  });
});

function Probe() {
  const { lang, setLang, t } = useI18n();
  return (
    <div>
      <p data-testid="lang">{lang}</p>
      <p data-testid="text">{t('menu.logout')}</p>
      <button onClick={() => setLang('zh-CN')}>to chinese</button>
      <button onClick={() => setLang('en-GB')}>to english</button>
    </div>
  );
}
const renderProbe = () =>
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );

describe('choosing a language', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = '';
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts in British English', () => {
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en-GB');
    expect(screen.getByTestId('text')).toHaveTextContent('Log out');
    expect(document.documentElement.lang).toBe('en-GB');
  });

  it('switches the text, the page language and the page title, and remembers the choice', async () => {
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole('button', { name: 'to chinese' }));
    expect(screen.getByTestId('text')).toHaveTextContent(zhCN['menu.logout']);
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.title).toBe(zhCN['header.title']);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('zh-CN');
  });

  it('comes back in the saved language', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('zh-CN');
  });

  it('ignores a saved value it does not know', () => {
    window.localStorage.setItem(STORAGE_KEY, 'fr-FR');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en-GB');
  });

  it('starts in Chinese for a browser set to Chinese, when nothing was chosen yet', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-TW');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('zh-CN');
  });

  it('prefers what the player chose over the browser language', () => {
    window.localStorage.setItem(STORAGE_KEY, 'en-GB');
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-CN');
    renderProbe();
    expect(screen.getByTestId('lang')).toHaveTextContent('en-GB');
  });

  it('still works when the browser will not let it save', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole('button', { name: 'to chinese' }));
    expect(screen.getByTestId('lang')).toHaveTextContent('zh-CN');
  });
});

describe('the language choice in the menu', () => {
  const session: Session = {
    idToken: 'tok',
    expiresAt: Date.now() + 60_000,
    user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
  };

  async function renderApp() {
    render(
      <LanguageProvider>
        <SessionContext.Provider value={{ session, logout: vi.fn() }}>
          <WalletProvider>
            <App />
          </WalletProvider>
        </SessionContext.Provider>
      </LanguageProvider>,
    );
    await screen.findByRole('button', { name: /menu/i });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    vi.mocked(api.getBalance).mockResolvedValue({ balance: 1234, version: 0 });
    vi.mocked(api.saveBalance).mockImplementation(async (_t, req) => ({ balance: req.balance, version: req.version + 1 }));
  });
  afterEach(() => cleanup());

  it('lists both languages in the menu, with the current one marked', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('menuitemradio', { name: 'English (UK)' })).toBeChecked();
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).not.toBeChecked();
  });

  it('switches the whole header and menu to Chinese, and back', async () => {
    const user = userEvent.setup();
    await renderApp();
    expect(screen.getByText('1,234 coins')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('menuitemradio', { name: '简体中文' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zhCN['header.title']);
    expect(screen.getByText(translate('zh-CN', 'header.coins', { amount: 1234 }))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: zhCN['menu.menu'] }));
    expect(screen.getByRole('menuitem', { name: zhCN['menu.logout'] })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: '简体中文' })).toBeChecked();

    await user.click(screen.getByRole('menuitemradio', { name: 'English (UK)' }));
    expect(screen.getByText('1,234 coins')).toBeInTheDocument();
  });

  it('remembers the choice for next time', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('menuitemradio', { name: '简体中文' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('zh-CN');
  });
});
