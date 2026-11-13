export interface NavGame {
  id: string;
  name: string;
  category: string;
}

interface GameNavProps {
  games: NavGame[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Two rows of tabs: the categories, then the games in the selected category.
 * Categories appear in the order they first show up in `games`.
 */
export function GameNav({ games, activeId, onSelect }: GameNavProps) {
  const categories = [...new Set(games.map((g) => g.category))];
  const activeCategory = games.find((g) => g.id === activeId)?.category ?? categories[0];

  return (
    <>
      <nav className="category-nav" aria-label="Game categories">
        {categories.map((category) => (
          <button
            key={category}
            className={category === activeCategory ? 'active' : undefined}
            // Jump to the first game in that category, unless you're already in it.
            onClick={() => category !== activeCategory && onSelect(games.find((g) => g.category === category)!.id)}
          >
            {category}
          </button>
        ))}
      </nav>
      <nav className="game-nav" aria-label={`${activeCategory} games`}>
        {games
          .filter((g) => g.category === activeCategory)
          .map((g) => (
            <button key={g.id} className={g.id === activeId ? 'active' : undefined} onClick={() => onSelect(g.id)}>
              {g.name}
            </button>
          ))}
      </nav>
    </>
  );
}
