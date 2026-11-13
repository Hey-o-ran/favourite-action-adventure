import {
  FILTER_KEYS,
  FILTER_LABELS,
  NO_FILTERS,
  activeFilterCount,
  filterOptions,
  matchesFilters,
  type Filters,
  type GameFacts,
} from '../gameFilters';

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
}

/** Filter dropdowns plus a row of the games that match them. */
export function GameNav({ games, activeId, onSelect, filters, onFiltersChange }: GameNavProps) {
  const matches = games.filter((g) => matchesFilters(g, filters));
  const active = games.find((g) => g.id === activeId);
  // Keep the game you're playing on screen even if a filter would hide it, so you never lose track of it.
  const shown = active && !matches.includes(active) ? [active, ...matches] : matches;
  const filtering = activeFilterCount(filters) > 0;

  return (
    <>
      <div className="filters" role="group" aria-label="Find a game">
        {FILTER_KEYS.map((key) => (
          <label key={key} className="filter">
            <span>{FILTER_LABELS[key]}</span>
            <select value={filters[key]} onChange={(e) => onFiltersChange({ ...filters, [key]: e.target.value })}>
              <option value="">Any</option>
              {filterOptions(key, games).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
        {filtering && <button onClick={() => onFiltersChange(NO_FILTERS)}>Clear filters</button>}
      </div>

      <p className="match-count" aria-live="polite">
        {filtering ? `${matches.length} of ${games.length} games match` : `${games.length} games`}
      </p>

      <nav className="game-nav" aria-label="Games">
        {shown.map((g) => (
          <button
            key={g.id}
            className={[g.id === activeId && 'active', !matches.includes(g) && 'outside'].filter(Boolean).join(' ') || undefined}
            onClick={() => onSelect(g.id)}
            title={matches.includes(g) ? undefined : "This game doesn't match your filters"}
          >
            {g.name}
          </button>
        ))}
        {matches.length === 0 && <span className="muted">No games match. Try clearing a filter.</span>}
      </nav>
    </>
  );
}
