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
import { AdminPanel } from './components/AdminPanel';
import { useSession } from './session';
import { NO_FILTERS, UNCLEAR_ORIGIN, originLabel, type Filters, type GameFacts, type SortOrder } from './gameFilters';

interface GameEntry extends GameFacts {
  id: string;
  name: string;
  blurb: string;
  Component: ComponentType;
}

/**
 * Add new games here. Each one manages its own state and uses the shared wallet.
 * The facts (origin, players, type, skill) feed the filters, so fill them in for every game.
 */
const GAMES: GameEntry[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    blurb: 'Beat the dealer to 21 without going over. Blackjack pays 3 to 2.',
    origin: 'Spain',
    originNote: 'The earliest mention of a 21 game is Spanish, from about 1601. France made it popular as "vingt-et-un".',
    players: 'Vs the house',
    type: 'Beat the dealer',
    skill: 'Mix of both',
    popularity: 2,
    Component: Blackjack,
  },
  {
    id: 'baccarat',
    name: 'Baccarat',
    blurb: 'Bet on Player, Banker or a Tie. The hand closest to 9 wins. The cards play themselves out.',
    origin: 'Italy',
    originNote: 'Most stories say it began in Italy hundreds of years ago and became famous in France.',
    players: 'Vs the house',
    type: 'Bet on a winner',
    skill: 'Mostly luck',
    popularity: 3,
    Component: Baccarat,
  },
  {
    id: 'red-dog',
    name: 'Red Dog',
    blurb: 'Two cards are dealt. Bet that a third card lands between them. The tighter the gap, the bigger the payout.',
    origin: 'United States',
    originNote: 'It comes from American card rooms, and is also known as Yablon and Acey-Deucey.',
    players: 'Vs the house',
    type: 'Guess the card',
    skill: 'Mostly luck',
    popularity: 7,
    Component: RedDog,
  },
  {
    id: 'video-poker',
    name: 'Jacks or Better',
    blurb: 'Five-card draw video poker. Hold your best cards, draw, and get paid for a winning hand.',
    origin: 'United States',
    originNote: 'Draw poker is an American game, and video poker machines were first built in the US.',
    players: 'Vs the house',
    type: 'Poker',
    skill: 'Mix of both',
    popularity: 4,
    Component: VideoPoker,
  },
  {
    id: 'klondike',
    name: 'Klondike Solitaire',
    blurb: 'Bet to deal. Build all four foundations to win 2× your bet. Give up or get stuck and you lose it.',
    origin: UNCLEAR_ORIGIN,
    originNote: "It's named after the Klondike gold rush in Canada, but solitaire games in general come from Europe.",
    players: 'Solo',
    type: 'Solitaire',
    skill: 'Mostly skill',
    popularity: 1,
    Component: Klondike,
  },
  {
    id: 'higher-lower',
    name: 'Higher or Lower',
    blurb: 'Guess whether the next card is higher or lower. Each correct guess grows the pot. Cash out any time.',
    origin: UNCLEAR_ORIGIN,
    originNote: 'Nobody knows who invented it. TV shows like "Play Your Cards Right" made it famous.',
    players: 'Solo',
    type: 'Guess the card',
    skill: 'Mostly luck',
    popularity: 6,
    Component: HigherLower,
  },
  {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    blurb: 'Match the top card by suit or rank. 8s are wild. Be first to empty your hand to win 2× your bet.',
    origin: 'United States',
    originNote: 'The best-known American game in the "Eights" family, from the 1930s and 1940s.',
    players: '2 players',
    type: 'Empty your hand',
    skill: 'Mix of both',
    popularity: 5,
    Component: CrazyEights,
  },
];

export function App() {
  const { balance, refill } = useWallet();
  const { session, logout } = useSession();
  const [activeId, setActiveId] = useState(GAMES[0].id);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortOrder>('default');
  const [view, setView] = useState<'game' | 'rules' | 'updates' | 'admin'>('game');
  const showRules = view !== 'game';
  /** Clicking the button for the page you're already on takes you back to the games. */
  const toggleView = (target: 'rules' | 'updates' | 'admin') => setView((v) => (v === target ? 'game' : target));
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
          {session.user.isAdmin && (
            <button onClick={() => toggleView('admin')} aria-pressed={view === 'admin'}>
              {view === 'admin' ? 'Back to game' : 'ADMIN ONLY'}
            </button>
          )}
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

      {view === 'rules' && (
        <Rules
          games={GAMES}
          gameId={activeId}
          onSelect={setActiveId}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
        />
      )}
      {view === 'updates' && <UpdateLog />}
      {view === 'admin' && session.user.isAdmin && <AdminPanel />}

      {/* The game view stays mounted (just hidden) while rules show, so an unfinished hand isn't lost. */}
      <div hidden={showRules}>
        <GameNav
          games={GAMES}
          activeId={activeId}
          onSelect={setActiveId}
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
        />

        <p className="blurb">{active.blurb}</p>
        <p className="facts">
          {[originLabel(active), active.players, active.type, active.skill].join(' · ')}
          {active.originNote && <span className="origin-note"> {active.originNote}</span>}
        </p>

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
