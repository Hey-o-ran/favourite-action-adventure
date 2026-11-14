import { useState } from 'react';
import { useWallet } from '../wallet';
import { useDealLock } from '../useDealLock';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import {
  JACKPOT_MULTIPLIER,
  cashOutHigherLower,
  guessHigherLower,
  guessJackpot,
  nextPot,
  startHigherLower,
  type HigherLowerState,
} from './higherLowerRules';

export function HigherLower() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<HigherLowerState | null>(null);
  const { locked, lock } = useDealLock();

  const playing = game?.status === 'playing';

  const start = () => {
    if (!wager(bet)) return;
    setGame(startHigherLower(game?.deck ?? shuffle(newDeck()), bet));
    lock();
  };

  const guess = (direction: 'higher' | 'lower') => {
    if (locked || !game) return;
    const next = guessHigherLower(game, direction);
    setGame(next);
    // A wrong guess ends the round. The wallet expects a settle for every wager, with 0 for a loss.
    if (next.status === 'lost') settle(0);
  };

  const cashOut = () => {
    if (locked || !game) return;
    const next = cashOutHigherLower(game);
    if (next.status !== 'cashed') return;
    setGame(next);
    settle(next.pot);
  };

  const jackpot = () => {
    if (locked || !game) return;
    const next = guessJackpot(game);
    if (next.status !== 'jackpot') {
      setGame(next);
      if (next.status === 'lost') settle(0);
      return;
    }
    setGame(next);
    settle(next.pot);
  };

  return (
    <section className="table">
      <h2>Higher or Lower</h2>

      <div className="cards">
        {game && <CardView card={game.current} />}
        {!game && <div className="slot" />}
      </div>

      <p className="result">
        {game && playing && (
          <>
            Streak {game.streak} · pot <span className="gain">{game.pot}</span>
            {game.streak > 0 && <> · cash out to keep it, or guess again to reach {nextPot(game.pot)}</>}
          </>
        )}
        {game?.status === 'lost' && (
          <>
            Wrong (or tie). You lost <span className="loss">{game.bet} coins</span>.
          </>
        )}
        {game?.status === 'cashed' && (
          <>
            Cashed out <span className="gain">{game.pot} coins</span>.
          </>
        )}
        {game?.status === 'jackpot' && (
          <>
            JACKPOT! Same rank. <span className="gain">+{game.pot - game.bet} coins</span>
          </>
        )}
      </p>

      <div className="actions">
        {playing ? (
          <>
            <button className="primary" onClick={() => guess('higher')} disabled={locked}>
              Higher ▲
            </button>
            <button className="primary" onClick={() => guess('lower')} disabled={locked}>
              Lower ▼
            </button>
            <button onClick={cashOut} disabled={locked || game.streak === 0}>
              Cash out
            </button>
            <button className="jackpot" onClick={jackpot} disabled={locked} title={`Next card has the same rank. Pays ${JACKPOT_MULTIPLIER}× the pot.`}>
              JACKPOT! (same rank, {JACKPOT_MULTIPLIER}×)
            </button>
          </>
        ) : (
          <button className="primary" onClick={start} disabled={balance < bet}>
            {game ? 'Play again' : 'Start'}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
    </section>
  );
}
