// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GLAGGLE_COLOURS, GLAGGLE_FOR, GlaggleFace, GlaggleRow, type GlaggleName } from './components/GlaggleFace';
import { Rules } from './components/Rules';
import { Slots } from './games/Slots';
import { SYMBOL_NAME, type SlotSymbol } from './games/slotsRules';
import { LanguageProvider, STORAGE_KEY, translate } from './i18n';
import { NO_FILTERS } from './gameFilters';
import { SessionContext, type Session } from './session';
import { WalletProvider } from './wallet';
import { fakeBalanceServer } from './testBalanceServer';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, getBalance: vi.fn(), saveBalance: vi.fn() };
});

const EMOJI = /[🍒🍋🍇🔔💎]|7️⃣/u;
const SYMBOLS: SlotSymbol[] = ['cherry', 'lemon', 'grape', 'bell', 'diamond', 'seven'];
const NAMES: Record<GlaggleName, string> = {
  giggler: 'Giggler',
  gazo: 'Gazo',
  gloober: 'Gloober',
  gembo: 'Gembo',
  gleeber: 'Gleeber',
  glabber: 'Glabber',
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('which Glaggle is which slot symbol', () => {
  it('is the Glaggle the player chose for each one', () => {
    expect(GLAGGLE_FOR).toEqual({
      cherry: 'giggler',
      lemon: 'gazo',
      grape: 'gloober',
      bell: 'gembo',
      diamond: 'gleeber',
      seven: 'glabber',
    });
  });

  it('gives every symbol its own colour, with the colours the wiki describes for the ones it describes', () => {
    const colours = Object.values(GLAGGLE_COLOURS);
    expect(new Set(colours).size).toBe(6);
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return { r, g, b };
    };
    const giggler = hue(GLAGGLE_COLOURS.giggler); // yellow: lots of red and green, little blue
    expect(giggler.r).toBeGreaterThan(200);
    expect(giggler.g).toBeGreaterThan(180);
    expect(giggler.b).toBeLessThan(120);
    const gazo = hue(GLAGGLE_COLOURS.gazo); // indigo: blue is the strongest
    expect(gazo.b).toBeGreaterThan(gazo.r);
    expect(gazo.b).toBeGreaterThan(gazo.g);
    const glabber = hue(GLAGGLE_COLOURS.glabber); // orange: red high, green middle, blue low
    expect(glabber.r).toBeGreaterThan(glabber.g);
    expect(glabber.g).toBeGreaterThan(glabber.b);
    const gleeber = hue(GLAGGLE_COLOURS.gleeber); // purple: red and blue high, green low
    expect(gleeber.g).toBeLessThan(gleeber.r);
    expect(gleeber.g).toBeLessThan(gleeber.b);
    const gembo = hue(GLAGGLE_COLOURS.gembo); // coral: red high, a little green and blue
    expect(gembo.r).toBeGreaterThan(220);
    expect(gembo.r).toBeGreaterThan(gembo.g);
  });
});

describe('a Glaggle face', () => {
  it.each(SYMBOLS)('is a picture named for the %s symbol, in British English', (symbol) => {
    render(<GlaggleFace symbol={symbol} />);
    expect(screen.getByRole('img', { name: NAMES[GLAGGLE_FOR[symbol]] })).toBeInTheDocument();
  });

  it('is named in Chinese in the Chinese version', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    render(
      <LanguageProvider>
        <GlaggleFace symbol="cherry" />
      </LanguageProvider>,
    );
    expect(screen.getByRole('img', { name: translate('zh-CN', 'glaggle.giggler') })).toBeInTheDocument();
    expect(translate('zh-CN', 'glaggle.giggler')).not.toMatch(/[A-Za-z]/);
  });

  it('can be left out of what a screen reader says, when the text beside it already says it', () => {
    render(<GlaggleFace symbol="seven" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('can be shown several times in a row', () => {
    render(<GlaggleRow symbol="lemon" count={3} />);
    expect(screen.getAllByRole('img', { name: 'Gazo' })).toHaveLength(3);
  });

  it('has a different look for each Glaggle (not only a different colour)', () => {
    const looks = SYMBOLS.map((symbol) => {
      const { container, unmount } = render(<GlaggleFace symbol={symbol} />);
      const svg = container.innerHTML.replace(/id="[^"]*"/g, '').replace(/url\(#[^)]*\)/g, '');
      unmount();
      return svg;
    });
    expect(new Set(looks).size).toBe(6);
  });
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
};

describe('the slot machine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const server = fakeBalanceServer();
    vi.mocked(api.getBalance).mockImplementation(server.get);
    vi.mocked(api.saveBalance).mockImplementation(server.save);
  });

  async function machine() {
    const view = render(
      <SessionContext.Provider value={{ session, logout: vi.fn() }}>
        <WalletProvider saveDelayMs={20}>
          <Slots />
        </WalletProvider>
      </SessionContext.Provider>,
    );
    await screen.findByRole('button', { name: /spin/i });
    return view;
  }

  it('shows Glaggle faces on the reels, and no fruit or emoji at all', async () => {
    const { container } = await machine();
    expect(container.textContent).not.toMatch(EMOJI);
    for (const reel of container.querySelectorAll('.sl-reel')) {
      expect(reel.querySelectorAll('.sl-cell svg')).toHaveLength(3);
    }
  });

  it('names the symbols after the Glaggles for a screen reader', async () => {
    await machine();
    const reel = screen.getByRole('img', { name: /^Reel 1:/ });
    expect(reel.getAttribute('aria-label')).toMatch(/Giggler|Gazo|Gloober|Gembo|Gleeber|Glabber/);
    expect(reel.getAttribute('aria-label')).not.toMatch(/cherry|lemon|grape|bell|diamond|seven/i);
  });

  it('shows each Glaggle three times in the pay table, with its name, and two Gigglers for the small prize', async () => {
    await machine();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('row', { name: /three glabbers/i })).toHaveTextContent('100×');
    expect(within(table).getByRole('row', { name: /three gleebers/i })).toHaveTextContent('40×');
    expect(within(table).getByRole('row', { name: /three gembos/i })).toHaveTextContent('20×');
    expect(within(table).getByRole('row', { name: /three gloobers/i })).toHaveTextContent('10×');
    expect(within(table).getByRole('row', { name: /three gazos/i })).toHaveTextContent('6×');
    expect(within(table).getByRole('row', { name: /three gigglers/i })).toHaveTextContent('5×');
    expect(within(table).getByRole('row', { name: /any two gigglers/i })).toHaveTextContent('3×');
    expect(table.querySelectorAll('svg').length).toBe(6 * 3 + 2);
  });

  it('keeps the old names only as the rules know them: every symbol still has a name', () => {
    for (const symbol of SYMBOLS) expect(SYMBOL_NAME[symbol]).toBe(NAMES[GLAGGLE_FOR[symbol]]);
  });
});

describe('the Rules page for Slots', () => {
  const renderRules = (zh = false) => {
    if (zh) window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    return render(
      <LanguageProvider>
        <Rules games={[]} gameId="slots" onSelect={() => {}} filters={NO_FILTERS} onFiltersChange={() => {}} sort="default" onSortChange={() => {}} />
      </LanguageProvider>,
    );
  };

  it('shows the Glaggles in the picture and in the list of prizes, and no emoji', () => {
    const { container } = renderRules();
    expect(container.textContent).not.toMatch(EMOJI);
    expect(container.querySelectorAll('.rules-diagram svg svg').length).toBeGreaterThanOrEqual(9); // 3 reels x 3 rows
    expect(container.querySelectorAll('li svg').length).toBe(6 * 3 + 2);
    expect(container.textContent).toMatch(/Exactly two Gigglers/);
    expect(container.textContent).not.toMatch(/cherr|lemon|grape|bell|diamond/i);
  });

  it('describes the picture with the Glaggles, and says which are rare', () => {
    const { container } = renderRules();
    const label = container.querySelector('.rules-diagram svg')!.getAttribute('aria-label')!;
    expect(label).toMatch(/Glabber/);
    expect(container.textContent).toMatch(/the rare ones \(the Glabber and the Gleeber\)/);
  });

  it('is all in Chinese, with Chinese names for the Glaggles', () => {
    const { container } = renderRules(true);
    const names = ['giggler', 'gazo', 'gloober', 'gembo', 'gleeber', 'glabber'] as const;
    for (const n of names) expect(container.querySelector(`[aria-label="${translate('zh-CN', `glaggle.${n}`)}"]`), n).not.toBeNull();
    expect(container.textContent).not.toMatch(/[A-Za-z]{2,}/);
    const label = container.querySelector('.rules-diagram svg')!.getAttribute('aria-label')!;
    expect(label).not.toMatch(/[A-Za-z]{2,}/);
  });
});
