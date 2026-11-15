import { describe, expect, it } from 'vitest';
import {
  NO_FILTERS,
  UNCLEAR_ORIGIN,
  activeFilterCount,
  filterOptions,
  matchesFilters,
  originLabel,
  SORT_OPTIONS,
  sortGames,
  type GameFacts,
} from './gameFilters';

const game = (over: Partial<GameFacts> = {}): GameFacts => ({
  category: 'Card games',
  origin: 'France',
  players: 'Vs the house',
  type: 'Beat the dealer',
  skill: 'Mix of both',
  popularity: 1,
  length: 5,
  ...over,
});

describe('game filters', () => {
  it('matches everything when no filter is set', () => {
    expect(matchesFilters(game(), NO_FILTERS)).toBe(true);
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
  });

  it('matches on a single filter', () => {
    expect(matchesFilters(game({ origin: 'Italy' }), { ...NO_FILTERS, origin: 'Italy' })).toBe(true);
    expect(matchesFilters(game({ origin: 'Italy' }), { ...NO_FILTERS, origin: 'France' })).toBe(false);
  });

  it('requires every set filter to match', () => {
    const g = game({ origin: 'Italy', players: 'Solo' });
    expect(matchesFilters(g, { ...NO_FILTERS, origin: 'Italy', players: 'Solo' })).toBe(true);
    expect(matchesFilters(g, { ...NO_FILTERS, origin: 'Italy', players: '2 players' })).toBe(false);
    expect(activeFilterCount({ ...NO_FILTERS, origin: 'Italy', players: 'Solo' })).toBe(2);
  });

  it('offers only values some game has, without duplicates', () => {
    const games = [game({ origin: 'Spain' }), game({ origin: 'Spain' }), game({ origin: 'Italy' })];
    expect(filterOptions('origin', games)).toEqual(['Italy', 'Spain']);
  });

  it('puts Unclear last in the country list', () => {
    const games = [game({ origin: UNCLEAR_ORIGIN }), game({ origin: 'United States' }), game({ origin: 'Italy' })];
    expect(filterOptions('origin', games)).toEqual(['Italy', 'United States', UNCLEAR_ORIGIN]);
  });

  it('keeps players and skill in their natural order, not alphabetical', () => {
    const games = [
      game({ players: '2 players', skill: 'Mostly skill' }),
      game({ players: 'Solo', skill: 'Mostly luck' }),
      game({ players: 'Vs the house', skill: 'Mix of both' }),
    ];
    expect(filterOptions('players', games)).toEqual(['Solo', 'Vs the house', '2 players']);
    expect(filterOptions('skill', games)).toEqual(['Mostly luck', 'Mix of both', 'Mostly skill']);
  });

  it('filters by category, with card games first in the list', () => {
    const cards = game({ category: 'Card games' });
    const wheel = game({ category: 'Non-card games' });
    expect(matchesFilters(wheel, { ...NO_FILTERS, category: 'Non-card games' })).toBe(true);
    expect(matchesFilters(cards, { ...NO_FILTERS, category: 'Non-card games' })).toBe(false);
    expect(filterOptions('category', [wheel, cards])).toEqual(['Card games', 'Non-card games']);
    expect(filterOptions('category', [cards])).toEqual(['Card games']); // nothing to choose until a non-card game exists
  });

  it('words the origin, saying so when it is unclear', () => {
    expect(originLabel(game({ origin: 'Italy' }))).toBe('From Italy');
    expect(originLabel(game({ origin: UNCLEAR_ORIGIN }))).toBe('Origin unclear');
  });
});

describe('sorting games', () => {
  const games = [
    { name: 'C', ...game({ popularity: 3 }) },
    { name: 'A', ...game({ popularity: 1 }) },
    { name: 'B', ...game({ popularity: 2 }) },
  ];
  const names = (list: { name: string }[]) => list.map((g) => g.name).join('');

  it('keeps the original order by default', () => {
    expect(names(sortGames(games, 'default'))).toBe('CAB');
  });

  it('puts the most popular game (lowest number) first', () => {
    expect(names(sortGames(games, 'popularity'))).toBe('ABC');
  });

  it('leaves the original list untouched', () => {
    sortGames(games, 'popularity');
    expect(names(games)).toBe('CAB');
  });

  it('keeps ties in their original order', () => {
    const tied = [
      { name: 'X', ...game({ popularity: 2 }) },
      { name: 'Y', ...game({ popularity: 1 }) },
      { name: 'Z', ...game({ popularity: 2 }) },
    ];
    expect(names(sortGames(tied, 'popularity'))).toBe('YXZ');
  });
});

describe('sorting games alphabetically', () => {
  const named = (...list: string[]) => list.map((name, i) => ({ name, ...game({ popularity: i + 1 }) }));
  const order = (list: { name: string }[]) => list.map((g) => g.name).join(', ');

  it('puts the games in A to Z order by name', () => {
    expect(order(sortGames(named('Red Dog', 'Blackjack', 'Gin Rummy', 'Baccarat'), 'alphabetical'))).toBe(
      'Baccarat, Blackjack, Gin Rummy, Red Dog',
    );
  });

  it('ignores capital letters and accents', () => {
    expect(order(sortGames(named('zebra', 'Éclair', 'apple', 'Banana'), 'alphabetical'))).toBe('apple, Banana, Éclair, zebra');
  });

  it('puts numbers in number order, not letter by letter', () => {
    expect(order(sortGames(named('Game 10', 'Game 9', 'Game 2'), 'alphabetical'))).toBe('Game 2, Game 9, Game 10');
  });

  it('sorts by the name the player sees, so a Chinese player gets pinyin order', () => {
    // bai (百), de (德), er (二), ya (亚)
    const chinese = named('二十一点', '百家乐', '德州扑克', '亚');
    expect(order(sortGames(chinese, 'alphabetical', 'zh-CN'))).toBe('百家乐, 德州扑克, 二十一点, 亚');
  });

  it('keeps games with the same name in their original order, and leaves the list untouched', () => {
    const same = [
      { name: 'Twin', ...game({ popularity: 5 }) },
      { name: 'Twin', ...game({ popularity: 1 }) },
      { name: 'Alpha', ...game({ popularity: 3 }) },
    ];
    const sorted = sortGames(same, 'alphabetical');
    expect(sorted.map((g) => g.popularity)).toEqual([3, 5, 1]);
    expect(same.map((g) => g.popularity)).toEqual([5, 1, 3]);
  });

  it('offers it in the Sort by choices, after the other two', () => {
    expect(SORT_OPTIONS.map((o) => o.id)).toEqual(['default', 'popularity', 'alphabetical', 'length']);
  });
});

describe('sorting games by how long one game takes', () => {
  const timed = (...minutes: number[]) => minutes.map((length, i) => ({ name: 'G' + i, ...game({ length }) }));
  const lengths = (list: { length: number }[]) => list.map((g) => g.length);

  it('puts the shortest game first', () => {
    expect(lengths(sortGames(timed(15, 0.5, 5, 10), 'length'))).toEqual([0.5, 5, 10, 15]);
  });

  it('keeps games that take equally long in their original order', () => {
    const sorted = sortGames(timed(5, 1, 5, 1), 'length');
    expect(sorted.map((g) => g.name)).toEqual(['G1', 'G3', 'G0', 'G2']);
  });

  it('leaves the original list untouched', () => {
    const list = timed(9, 2);
    sortGames(list, 'length');
    expect(lengths(list)).toEqual([9, 2]);
  });

  it('says what the length means: the time for one game, in minutes', () => {
    expect(game().length).toBeGreaterThan(0);
  });
});
