import { useState } from 'react';
import { useWallet } from '../wallet';
import { useDealLock } from '../useDealLock';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { useI18n } from '../i18n';
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
  const { t, tx } = useI18n();
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
      <h2>{t('game.higher-lower.name')}</h2>

      <div className="cards">
        {game && <CardView card={game.current} />}
        {!game && <div className="slot" />}
      </div>

      <p className="result">
        {game && playing && (
          <>
            {tx('hilo.streak', { streak: game.streak, pot: <span className="gain">{game.pot}</span> })}
            {game.streak > 0 && <>{t('hilo.keepOrGuess', { next: nextPot(game.pot) })}</>}
          </>
        )}
        {game?.status === 'lost' && (
          <>{tx('hilo.lost', { loss: <span className="loss">{t('game.coins', { amount: game.bet })}</span> })}</>
        )}
        {game?.status === 'cashed' && (
          <>{tx('hilo.cashed', { won: <span className="gain">{t('game.coins', { amount: game.pot })}</span> })}</>
        )}
        {game?.status === 'jackpot' && (
          <>{tx('hilo.jackpotWin', { gain: <span className="gain">{t('game.gain', { amount: game.pot - game.bet })}</span> })}</>
        )}
      </p>

      <div className="actions">
        {playing ? (
          <>
            <button className="primary" onClick={() => guess('higher')} disabled={locked}>
              {t('hilo.higher')}
            </button>
            <button className="primary" onClick={() => guess('lower')} disabled={locked}>
              {t('hilo.lower')}
            </button>
            <button onClick={cashOut} disabled={locked || game.streak === 0}>
              {t('hilo.cashOut')}
            </button>
            <button
              className="jackpot"
              onClick={jackpot}
              disabled={locked}
              title={t('hilo.jackpotHint', { multiplier: JACKPOT_MULTIPLIER })}
            >
              {t('hilo.jackpot', { multiplier: JACKPOT_MULTIPLIER })}
            </button>
          </>
        ) : (
          <button className="primary" onClick={start} disabled={balance < bet}>
            {game ? t('game.playAgain') : t('game.start')}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
    </section>
  );
}
