// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GameNav, type NavGame } from './components/GameNav';
import { NO_FILTERS, type SortOrder } from './gameFilters';
import { LanguageProvider, STORAGE_KEY, translate } from './i18n';

const facts = { category: 'Card games', origin: 'France', players: 'Vs the house', type: 'Poker', skill: 'Mix of both', difficulty: 'Easy' } as const;
const games = (...names: string[]): NavGame[] => names.map((name, i) => ({ id: `g${i}`, name, popularity: i + 1, length: 10 - i, ...facts }));

function renderNav(list: NavGame[], sort: SortOrder, onSortChange = vi.fn()) {
  render(
    <LanguageProvider>
      <GameNav games={list} activeId="g0" onSelect={() => {}} filters={NO_FILTERS} onFiltersChange={() => {}} sort={sort} onSortChange={onSortChange} />
    </LanguageProvider>,
  );
  return onSortChange;
}
const buttons = () => within(screen.getByRole('navigation')).getAllByRole('button').map((b) => b.textContent);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('the Sort by box, in British English', () => {
  it('offers Alphabetical (A–Z) as a choice', () => {
    renderNav(games('Red Dog', 'Blackjack'), 'default');
    const sort = screen.getByRole('combobox', { name: 'Sort by' });
    expect(within(sort).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Default order',
      'Most popular first',
      'Alphabetical (A–Z)',
      'Shortest game first',
    ]);
  });

  it('tells the page when it is chosen', async () => {
    const onSortChange = renderNav(games('Red Dog', 'Blackjack'), 'default');
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Alphabetical (A–Z)');
    expect(onSortChange).toHaveBeenCalledWith('alphabetical');
  });

  it('lines the games up A to Z', () => {
    renderNav(games('Red Dog', 'Blackjack', 'Gin Rummy', 'Baccarat'), 'alphabetical');
    expect(buttons()).toEqual(['Baccarat', 'Blackjack', 'Gin Rummy', 'Red Dog']);
  });
});

describe('sorting by the length of a game', () => {
  it('lines the games up from the shortest to the longest', () => {
    // length is 10 - position, so the last game listed is the shortest
    renderNav(games('Gin Rummy', 'Klondike', 'Slots'), 'length');
    expect(buttons()).toEqual(['Slots', 'Klondike', 'Gin Rummy']);
  });

  it('tells the page when it is chosen', async () => {
    const onSortChange = renderNav(games('Gin Rummy', 'Slots'), 'default');
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Shortest game first');
    expect(onSortChange).toHaveBeenCalledWith('length');
  });

  it('is worded in Chinese in the Chinese version', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    renderNav(games('二十一点', '百家乐'), 'length');
    const sort = screen.getByRole('combobox', { name: translate('zh-CN', 'nav.sortBy') });
    expect(within(sort).getByRole('option', { name: translate('zh-CN', 'nav.sortLength') })).toBeInTheDocument();
  });
});

describe('the Sort by box, in Chinese', () => {
  it('words the choice in Chinese and orders the games by pinyin', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    renderNav(games('二十一点', '百家乐', '德州扑克'), 'alphabetical');
    const sort = screen.getByRole('combobox', { name: translate('zh-CN', 'nav.sortBy') });
    expect(within(sort).getByRole('option', { name: translate('zh-CN', 'nav.sortAlphabetical') })).toBeInTheDocument();
    expect(buttons()).toEqual(['百家乐', '德州扑克', '二十一点']);
  });
});

describe('the How hard to learn box', () => {
  const nav = (zh = false) => {
    if (zh) window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    const list: NavGame[] = [
      { ...games('A')[0], id: 'a', difficulty: 'Hard' },
      { ...games('B')[0], id: 'b', difficulty: 'Easy' },
      { ...games('C')[0], id: 'c', difficulty: 'Medium' },
    ];
    return renderNav(list, 'default');
  };

  it('is a filter with Any, Easy, Medium and Hard, in that order', () => {
    nav();
    const box = screen.getByRole('combobox', { name: 'How hard to learn' });
    expect(within(box).getAllByRole('option').map((o) => o.textContent)).toEqual(['Any', 'Easy', 'Medium', 'Hard']);
  });

  it('hands the choice to the page', async () => {
    const onFilters = vi.fn();
    render(
      <LanguageProvider>
        <GameNav games={[{ ...games('A')[0], difficulty: 'Easy' }]} activeId="g0" onSelect={() => {}} filters={NO_FILTERS} onFiltersChange={onFilters} sort="default" onSortChange={() => {}} />
      </LanguageProvider>,
    );
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'How hard to learn' }), 'Easy');
    expect(onFilters).toHaveBeenCalledWith({ ...NO_FILTERS, difficulty: 'Easy' });
  });

  it('is worded in Chinese in the Chinese version', () => {
    nav(true);
    const box = screen.getByRole('combobox', { name: translate('zh-CN', 'filter.difficulty') });
    expect(within(box).getAllByRole('option').map((o) => o.textContent)).toEqual([
      translate('zh-CN', 'nav.any'),
      translate('zh-CN', 'fact.Easy'),
      translate('zh-CN', 'fact.Medium'),
      translate('zh-CN', 'fact.Hard'),
    ]);
  });
});
