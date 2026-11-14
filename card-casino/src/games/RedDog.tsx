import { useState } from 'react';
import { useWallet } from '../wallet';
import { useDealLock } from '../useDealLock';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { useI18n } from '../i18n';
import { dealThird, spreadPayout, startRedDog, type RedDogState } from './redDogRules';

export function RedDog() {
  const { balance, wager, settle } = useWallet();
  const { t, tx } = useI18n();
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<RedDogState | null>(null);
  const { locked, lock } = useDealLock();

  const deciding = game?.status === 'decide';
  const halfRaise = Math.floor(bet / 2);

  const deal = () => {
    if (!wager(bet)) return;
    // Fresh shuffle every round, so what was dealt before can't help you.
    const next = startRedDog(shuffle(newDeck()), bet);
    setGame(next);
    // Consecutive cards and pairs finish on the spot.
    if (next.status !== 'decide') settle(next.returned);
    else lock();
  };

  const draw = (raise: number) => {
    if (locked || !game || game.status !== 'decide') return;
    if (raise > 0 && !wager(raise)) return;
    const next = dealThird(game, raise);
    setGame(next);
    settle(next.returned);
  };

  const stake = game ? game.bet + game.raise : 0;

  return (
    <section className="table">
      <h2>{t('game.red-dog.name')}</h2>

      <div className="cards">
        {game ? (
          <>
            <CardView card={game.cards[0]} />
            {game.third ? <CardView card={game.third} /> : <div className="slot" />}
            <CardView card={game.cards[1]} />
          </>
        ) : (
          <div className="slot" />
        )}
      </div>

      <p className="result">
        {deciding &&
          tx(game.spread === 1 ? 'reddog.betweenOne' : 'reddog.betweenMany', {
            count: game.spread,
            pays: <span className="gain">{t('reddog.ratio', { n: spreadPayout(game.spread) })}</span>,
          })}
        {game?.status === 'push' && game.spread === 0 && <>{t('reddog.consecutive')}</>}
        {game?.status === 'push' && game.spread < 0 && <>{t('reddog.pair')}</>}
        {game?.status === 'won' && game.spread < 0 && (
          <>{tx('reddog.threeKind', { gain: <span className="gain">{t('game.gain', { amount: game.returned - game.bet })}</span> })}</>
        )}
        {game?.status === 'won' && game.spread > 0 && (
          <>{tx('reddog.between', { gain: <span className="gain">{t('game.gain', { amount: game.returned - stake })}</span> })}</>
        )}
        {game?.status === 'lost' && (
          <>{tx('reddog.lost', { loss: <span className="loss">{t('game.coins', { amount: stake })}</span> })}</>
        )}
      </p>

      <div className="actions">
        {deciding ? (
          <>
            <button className="primary" onClick={() => draw(0)} disabled={locked}>
              {t('reddog.third')}
            </button>
            <button onClick={() => draw(halfRaise)} disabled={locked || halfRaise < 1 || balance < halfRaise}>
              {t('reddog.raise', { amount: halfRaise })}
            </button>
            <button onClick={() => draw(game.bet)} disabled={locked || balance < game.bet}>
              {t('reddog.raise', { amount: game.bet })}
            </button>
          </>
        ) : (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {game ? t('game.dealAgain') : t('game.deal')}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={deciding} />
    </section>
  );
}
