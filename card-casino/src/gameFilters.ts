import { factText, translate, type Translate } from './i18n';

/** How many people are at the table. "Vs the house" means you play against a dealer or bank, not other players. */
export const PLAYER_OPTIONS = ['Solo', 'Vs the house', '2 players', '3+ players'] as const;
/** Whether the game is played with playing cards. */
export const CATEGORY_OPTIONS = ['Card games', 'Non-card games'] as const;
export const SKILL_OPTIONS = ['Mostly luck', 'Mix of both', 'Mostly skill'] as const;
/** Use this origin when the history is disputed or unknown. It sorts last in the filter. */
export const UNCLEAR_ORIGIN = 'Unclear';

export interface GameFacts {
  category: (typeof CATEGORY_OPTIONS)[number];
  /** A country, or UNCLEAR_ORIGIN. Games like Blackjack have disputed histories, so say what's best supported. */
  origin: string;
  players: (typeof PLAYER_OPTIONS)[number];
  /** A short kid-friendly label for how the game is played, like "Solitaire" or "Guess the card". */
  type: string;
  skill: (typeof SKILL_OPTIONS)[number];
  /** One sentence of history shown under the game, especially where the origin is disputed. */
  originNote?: string;
  /**
   * Rough worldwide popularity, 1 = most popular. This is an estimate, not a measured ranking:
   * there is no reliable global card-game chart. Give every game its own number.
   */
  popularity: number;
  /**
   * Roughly how many minutes one game takes, for the Sort by box. An estimate, like popularity: one round of a
   * quick game, or one hand or match of a longer one. Fractions are fine (a spin of the slots is about 0.2).
   */
  length: number;
}

export type SortOrder = 'default' | 'popularity' | 'alphabetical' | 'length';
export const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: 'default', label: 'Default order' },
  { id: 'popularity', label: 'Most popular first' },
  { id: 'alphabetical', label: 'Alphabetical (A–Z)' },
  { id: 'length', label: 'Shortest game first' },
];

/**
 * Returns the games in the chosen order without changing the original list. Ties keep their original order.
 * Alphabetical order goes by the name the player sees, so pass the language: capitals and accents are ignored,
 * numbers count as numbers, and Chinese names come out in pinyin order.
 */
export function sortGames<T extends { popularity: number; length?: number; name?: string }>(games: readonly T[], sort: SortOrder, locale = 'en-GB'): T[] {
  const sorted = [...games];
  if (sort === 'popularity') sorted.sort((a, b) => a.popularity - b.popularity);
  if (sort === 'length') sorted.sort((a, b) => (a.length ?? 0) - (b.length ?? 0));
  if (sort === 'alphabetical') {
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    sorted.sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''));
  }
  return sorted;
}

export type FilterKey = 'category' | 'origin' | 'players' | 'type' | 'skill';
/** One chosen value per filter. An empty string means "Any". */
export type Filters = Record<FilterKey, string>;

/** Add a filter here and in GameFacts to give every game a new way to be found. */
export const FILTER_KEYS: FilterKey[] = ['category', 'origin', 'players', 'type', 'skill'];
export const FILTER_LABELS: Record<FilterKey, string> = {
  category: 'Category',
  origin: 'Country of origin',
  players: 'Players',
  type: 'Type of game',
  skill: 'Luck or skill',
};
export const NO_FILTERS: Filters = { category: '', origin: '', players: '', type: '', skill: '' };

/** A game passes if it matches every filter that is set. */
export const matchesFilters = (facts: GameFacts, filters: Filters) =>
  FILTER_KEYS.every((key) => filters[key] === '' || facts[key] === filters[key]);

export const activeFilterCount = (filters: Filters) => FILTER_KEYS.filter((key) => filters[key] !== '').length;

const ORDERED: Partial<Record<FilterKey, readonly string[]>> = { category: CATEGORY_OPTIONS, players: PLAYER_OPTIONS, skill: SKILL_OPTIONS };

/** The choices for a filter: only values some game really has, in a sensible order. */
export function filterOptions(key: FilterKey, games: readonly GameFacts[]): string[] {
  const values = [...new Set(games.map((g) => g[key]))];
  const order = ORDERED[key];
  if (order) return values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  // Alphabetical, with "Unclear" last so real countries come first.
  return values.sort((a, b) => Number(a === UNCLEAR_ORIGIN) - Number(b === UNCLEAR_ORIGIN) || a.localeCompare(b));
}

const english: Translate = (key, values) => translate('en-GB', key, values);

/** "From Spain" or "Origin unclear", in the language of `t` (British English when none is given). */
export const originLabel = (facts: GameFacts, t: Translate = english) =>
  facts.origin === UNCLEAR_ORIGIN ? t('facts.unclear') : t('facts.from', { country: factText(t, facts.origin) });
