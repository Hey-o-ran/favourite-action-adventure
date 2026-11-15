import {
  FILTER_KEYS,
  NO_FILTERS,
  activeFilterCount,
  filterOptions,
  matchesFilters,
  SORT_OPTIONS,
  sortGames,
  type Filters,
  type GameFacts,
  type SortOrder,
} from '../gameFilters';
import { factText, useI18n, type MessageKey } from '../i18n';

export interface NavGame extends GameFacts {
  id: string;
  name: string;
}

interface GameNavProps {
  games: NavGame[];
  activeId: string;
  onSelect: (id: string) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
}

const FILTER_NAME_KEYS: Record<(typeof FILTER_KEYS)[number], MessageKey> = {
  origin: 'filter.origin',
  players: 'filter.players',
  type: 'filter.type',
  skill: 'filter.skill',
};
const SORT_NAME_KEYS: Record<SortOrder, MessageKey> = { default: 'nav.sortDefault', popularity: 'nav.sortPopular' };

/** Filter and sort dropdowns plus a row of the games that match, in the chosen order. */
export function GameNav({ games, activeId, onSelect, filters, onFiltersChange, sort, onSortChange }: GameNavProps) {
  const { t } = useI18n();
  const matches = sortGames(
    games.filter((g) => matchesFilters(g, filters)),
    sort,
  );
  const active = games.find((g) => g.id === activeId);
  // Keep the game you're playing on screen even if a filter would hide it, so you never lose track of it.
  const shown = active && !matches.includes(active) ? [active, ...matches] : matches;
  const filtering = activeFilterCount(filters) > 0;

  return (
    <>
      <div className="filters" role="group" aria-label={t('nav.findGame')}>
        {FILTER_KEYS.map((key) => (
          <label key={key} className="filter">
            <span>{t(FILTER_NAME_KEYS[key])}</span>
            <select value={filters[key]} onChange={(e) => onFiltersChange({ ...filters, [key]: e.target.value })}>
              <option value="">{t('nav.any')}</option>
              {filterOptions(key, games).map((option) => (
                <option key={option} value={option}>
                  {factText(t, option)}
                </option>
              ))}
            </select>
          </label>
        ))}
        {filtering && <button onClick={() => onFiltersChange(NO_FILTERS)}>{t('nav.clear')}</button>}
        <label className="filter sort">
          <span>{t('nav.sortBy')}</span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value as SortOrder)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {t(SORT_NAME_KEYS[option.id])}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="match-count" aria-live="polite">
        {filtering
          ? t('nav.countMatching', { matching: matches.length, total: games.length })
          : t('nav.count', { count: games.length })}
      </p>

      <nav className="game-nav" aria-label={t('nav.games')}>
        {shown.map((g) => (
          <button
            key={g.id}
            className={[g.id === activeId && 'active', !matches.includes(g) && 'outside'].filter(Boolean).join(' ') || undefined}
            onClick={() => onSelect(g.id)}
            title={matches.includes(g) ? undefined : t('nav.outside')}
          >
            {g.name}
          </button>
        ))}
        {matches.length === 0 && <span className="muted">{t('nav.noMatch')}</span>}
      </nav>
    </>
  );
}
