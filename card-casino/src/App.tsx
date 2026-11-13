import { useState, type ComponentType } from 'react';
import { REFILL_AMOUNT, useWallet } from './wallet';
import { Blackjack } from './games/Blackjack';
import { Klondike } from './games/Klondike';
import { VideoPoker } from './games/VideoPoker';
import { HigherLower } from './games/HigherLower';
import { RedDog } from './games/RedDog';
import { Baccarat } from './games/Baccarat';
import { CrazyEights } from './games/CrazyEights';
import { GameNav } from './components/GameNav';
import { Rules } from './components/Rules';
import { UpdateLog } from './components/UpdateLog';

interface GameEntry {
  id: string;
  name: string;
  /**
   * Which group of tabs the game sits under. Categories show in the order they first appear below:
   * Table Games (you against the house), Poker, Solo (just you and the deck) and Versus Bots.
   */
  category: string;
  blurb: string;
  Component: ComponentType;
}

/** Add new games here, next to others of the same category. Each manages its own state and uses the shared wallet. */
const GAMES: GameEntry[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    category: 'Table Games',
    blurb: 'Beat the dealer to 21 without going over. Blackjack pays 3 to 2.',
    Component: Blackjack,
  },
  {
    id: 'baccarat',
    name: 'Baccarat',
    category: 'Table Games',
    blurb: 'Bet on Player, Banker or a Tie. The hand closest to 9 wins. The cards play themselves out.',
    Component: Baccarat,
  },
  {
    id: 'red-dog',
    name: 'Red Dog',
    category: 'Table Games',
    blurb: 'Two cards are dealt. Bet that a third card lands between them. The tighter the gap, the bigger the payout.',
    Component: RedDog,
  },
  {
    id: 'video-poker',
    name: 'Jacks or Better',
    category: 'Poker',
    blurb: 'Five-card draw video poker. Hold your best cards, draw, and get paid for a winning hand.',
    Component: VideoPoker,
  },
  {
    id: 'klondike',
    name: 'Klondike Solitaire',
    category: 'Solo',
    blurb: 'Bet to deal. Build all four foundations to win 2× your bet. Give up or get stuck and you lose it.',
    Component: Klondike,
  },
  {
    id: 'higher-lower',
    name: 'Higher or Lower',
    category: 'Solo',
    blurb: 'Guess whether the next card is higher or lower. Each correct guess grows the pot. Cash out any time.',
    Component: HigherLower,
  },
  {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    category: 'Versus Bots',
    blurb: 'Match the top card by suit or rank. 8s are wild. Be first to empty your hand to win 2× your bet.',
    Component: CrazyEights,
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
  const [view, setView] = useState<'game' | 'rules' | 'updates'>('game');
  const showRules = view !== 'game';
  /** Clicking the button for the page you're already on takes you back to the games. */
  const toggleView = (target: 'rules' | 'updates') => setView((v) => (v === target ? 'game' : target));
  const active = GAMES.find((g) => g.id === activeId)!;

  return (
    <div className="app">
      <header>
        <h1>Card Casino</h1>
        <div className="header-actions">
          <div className="balance" aria-live="polite">
            {balance.toLocaleString()} coins
          </div>
          <button onClick={() => toggleView('updates')} aria-pressed={view === 'updates'}>
            {view === 'updates' ? 'Back to game' : "What's new"}
          </button>
          <button onClick={() => toggleView('rules')} aria-pressed={view === 'rules'}>
            {view === 'rules' ? 'Back to game' : 'Rules'}
          </button>
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

      {view === 'rules' && <Rules games={GAMES} gameId={activeId} onSelect={setActiveId} />}
      {view === 'updates' && <UpdateLog />}

      {/* The game view stays mounted (just hidden) while rules show, so an unfinished hand isn't lost. */}
      <div hidden={showRules}>
        <GameNav games={GAMES} activeId={activeId} onSelect={setActiveId} />

        <p className="blurb">{active.blurb}</p>

        {/* Games stay mounted when hidden so an unfinished hand isn't lost when switching games. */}
        {GAMES.map(({ id, Component }) => (
          <div key={id} hidden={id !== activeId}>
            <Component />
          </div>
        ))}
      </div>
    </div>
  );
}
