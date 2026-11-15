// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import englishText from './__fixtures__/english-text.json?raw';
import { LanguageProvider, STORAGE_KEY } from './i18n';
import { Rules } from './components/Rules';
import { UpdateLog, UPDATES } from './components/UpdateLog';
import { ZH_UPDATES } from './i18n/zh-CN.updates';
import { NO_FILTERS } from './gameFilters';

/** The English text of every rules page and of What's new, as it was before the pages could be translated. */
const english = JSON.parse(englishText) as Record<
  string,
  { text: string; labels: string[] }
>;

const GAME_IDS = ['blackjack', 'klondike', 'video-poker', 'higher-lower', 'red-dog', 'baccarat', 'crazy-eights', 'slots', 'roulette', 'gin-rummy', 'holdem'];

const grab = (c: HTMLElement) => ({
  text: (c.textContent ?? '').replace(/\s+/g, ' ').trim(),
  labels: [...c.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? ''),
});

function renderRules(id: string, lang?: 'zh-CN') {
  if (lang) window.localStorage.setItem(STORAGE_KEY, lang);
  return render(
    <LanguageProvider>
      <Rules games={[]} gameId={id} onSelect={() => {}} filters={NO_FILTERS} onFiltersChange={() => {}} sort="default" onSortChange={() => {}} />
    </LanguageProvider>,
  );
}

/** Each piece of text on its own, so neighbouring pictures' labels (four Ace markers in a row) don't run together. */
function pieces(container: HTMLElement): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node.textContent ?? '');
  return out.join(' ');
}

/** Two or more letters in a row. Card ranks (A, K, Q) and symbols are fine; English words are not. */
const ENGLISH_WORD = /[A-Za-z]{2,}/;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('in British English, nothing has changed', () => {
  it.each(GAME_IDS)('the %s rules read exactly as before', (id) => {
    const { container } = renderRules(id);
    expect(grab(container)).toEqual(english[`rules:${id}`]);
  });

  it("What's new reads exactly as before", () => {
    const { container } = render(
      <LanguageProvider>
        <UpdateLog />
      </LanguageProvider>,
    );
    expect(grab(container)).toEqual(english.updates);
  });
});

describe('the rules in Chinese', () => {
  it.each(GAME_IDS)('the %s rules have no English left, in the text or in the picture descriptions', (id) => {
    const { container } = renderRules(id, 'zh-CN');
    const { text, labels } = grab(container);
    const separate = pieces(container);
    expect(separate.match(ENGLISH_WORD)?.[0], separate).toBeUndefined();
    for (const label of labels) expect(label.match(ENGLISH_WORD)?.[0], label).toBeUndefined();
    expect(text.length).toBeGreaterThan(200);
  });

  it('keeps the numbers from the game rules in step', () => {
    const { container } = renderRules('holdem', 'zh-CN');
    expect(container.textContent).toContain('100');
  });
});

describe("What's new in Chinese", () => {
  it('has a Chinese version of every update, with as many points as the English one', () => {
    for (const u of UPDATES) {
      const zh = ZH_UPDATES[u.id];
      expect(zh, u.id).toBeDefined();
      expect(zh.points.length, u.id).toBe(u.points.length);
      expect(zh.title.trim(), u.id).not.toBe('');
      expect(zh.date.trim(), u.id).not.toBe('');
    }
    expect(Object.keys(ZH_UPDATES).sort()).toEqual(UPDATES.map((u) => u.id).sort());
  });

  it('shows no English', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    const { container } = render(
      <LanguageProvider>
        <UpdateLog />
      </LanguageProvider>,
    );
    const text = grab(container).text;
    // Names of things in the casino that are written in English on purpose are not words to translate here.
    const leftover = text.replace(/chace\.haoran\.cloud/g, '').match(ENGLISH_WORD)?.[0];
    expect(leftover, text).toBeUndefined();
  });

  it('puts the newest first, in both languages', () => {
    expect(UPDATES[0].id).toBe('glaggles');
  });
});
