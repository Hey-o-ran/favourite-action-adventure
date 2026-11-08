import { useState, type ComponentType } from 'react';
import { REFILL_AMOUNT, useWallet } from './wallet';
import { Blackjack } from './games/Blackjack';
import { Klondike } from './games/Klondike';
import { VideoPoker } from './games/VideoPoker';
import { HigherLower } from './games/HigherLower';

interface GameEntry {
  id: string;
  name: string;
  blurb: string;
  Component: ComponentType;
}

/** Add new games here. Each one manages its own state and uses the shared wallet. */
const GAMES: GameEntry[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    blurb: 'Beat the dealer to 21 without going over. Blackjack pays 3 to 2.',
    Component: Blackjack,
  },
  {
    id: 'klondike',
    name: 'Klondike Solitaire',
    blurb: 'Bet to deal. Build all four foundations to win 2× your bet. Give up or get stuck and you lose it.',
    Component: Klondike,
  },
  {
    id: 'video-poker',
    name: 'Jacks or Better',
    blurb: 'Five-card draw video poker. Hold your best cards, draw, and get paid for a winning hand.',
    Component: VideoPoker,
  },
  {
    id: 'higher-lower',
    name: 'Higher or Lower',
    blurb: 'Guess whether the next card is higher or lower. Each correct guess grows the pot. Cash out any time.',
    Component: HigherLower,
  },
];

/** Clears the unlock flag and reloads, so the password gate shows again. */
function logout() {
  try {
    window.sessionStorage.removeItem('card-casino.unlocked');
  } catch {
    // Storage unavailable: the reload below still shows the gate if the flag was never set.
  }
  window.location.reload();
}

export function App() {
  const { balance, refill } = useWallet();
  const [activeId, setActiveId] = useState(GAMES[0].id);
  const active = GAMES.find((g) => g.id === activeId)!;

  return (
    <div className="app">
      <header>
        <h1>Card Casino</h1>
        <div className="header-actions">
          <div className="balance" aria-live="polite">
            {balance.toLocaleString()} coins
          </div>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      {balance === 0 && (
        <div className="banner">
          You're out of coins.{' '}
          <button className="primary" onClick={refill}>
            Claim {REFILL_AMOUNT} coins
          </button>
        </div>
      )}

      <nav>
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={g.id === activeId ? 'active' : undefined}
            onClick={() => setActiveId(g.id)}
          >
            {g.name}
          </button>
        ))}
      </nav>

      <p className="blurb">{active.blurb}</p>

      {/* Games stay mounted when hidden so an unfinished hand isn't lost when switching games. */}
      {GAMES.map(({ id, Component }) => (
        <div key={id} hidden={id !== activeId}>
          <Component />
        </div>
      ))}
    </div>
  );
}
