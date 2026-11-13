import { useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { dealThird, spreadPayout, startRedDog, type RedDogState } from './redDogRules';

export function RedDog() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<RedDogState | null>(null);

  const deciding = game?.status === 'decide';
  const halfRaise = Math.floor(bet / 2);

  const deal = () => {
    if (!wager(bet)) return;
    // Fresh shuffle every round, so what was dealt before can't help you.
    const next = startRedDog(shuffle(newDeck()), bet);
    setGame(next);
    // Consecutive cards and pairs finish on the spot.
    if (next.status !== 'decide') settle(next.returned);
  };

  const draw = (raise: number) => {
    if (!game || game.status !== 'decide') return;
    if (raise > 0 && !wager(raise)) return;
    const next = dealThird(game, raise);
    setGame(next);
    settle(next.returned);
  };

  const stake = game ? game.bet + game.raise : 0;

  return (
    <section className="table">
      <h2>Red Dog</h2>

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
        {deciding && (
          <>
            {game.spread} {game.spread === 1 ? 'card' : 'cards'} in between · pays{' '}
            <span className="gain">{spreadPayout(game.spread)} to 1</span>. Will the next card land between them?
          </>
        )}
        {game?.status === 'push' && game.spread === 0 && <>Consecutive cards: nothing can fit between them. Your bet is returned.</>}
        {game?.status === 'push' && game.spread < 0 && <>A pair, and the third card didn't match. Your bet is returned.</>}
        {game?.status === 'won' && game.spread < 0 && (
          <>
            Three of a kind! <span className="gain">+{game.returned - game.bet} coins</span>
          </>
        )}
        {game?.status === 'won' && game.spread > 0 && (
          <>
            Between them! <span className="gain">+{game.returned - stake} coins</span>
          </>
        )}
        {game?.status === 'lost' && (
          <>
            Not between. You lost <span className="loss">{stake} coins</span>.
          </>
        )}
      </p>

      <div className="actions">
        {deciding ? (
          <>
            <button className="primary" onClick={() => draw(0)}>
              Deal third card
            </button>
            <button onClick={() => draw(halfRaise)} disabled={halfRaise < 1 || balance < halfRaise}>
              Raise +{halfRaise}
            </button>
            <button onClick={() => draw(game.bet)} disabled={balance < game.bet}>
              Raise +{game.bet}
            </button>
          </>
        ) : (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {game ? 'Deal again' : 'Deal'}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={deciding} />
    </section>
  );
}
