import { describe, expect, it } from 'vitest';
import {
  NO_FILTERS,
  UNCLEAR_ORIGIN,
  activeFilterCount,
  filterOptions,
  matchesFilters,
  originLabel,
  type GameFacts,
} from './gameFilters';

const game = (over: Partial<GameFacts> = {}): GameFacts => ({
  origin: 'France',
  players: 'Vs the house',
  type: 'Beat the dealer',
  skill: 'Mix of both',
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

  it('words the origin, saying so when it is unclear', () => {
    expect(originLabel(game({ origin: 'Italy' }))).toBe('From Italy');
    expect(originLabel(game({ origin: UNCLEAR_ORIGIN }))).toBe('Origin unclear');
  });
});
