import { useState } from 'react';
import { useDealLock } from '../useDealLock';
import { useWallet } from '../wallet';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { dealRound, doubleDown, handValue, hit, stakeOf, stand, type Outcome, type Round } from './blackjackRules';

const OUTCOME_TEXT: Record<Outcome, string> = {
  blackjack: 'Blackjack! Pays 3 to 2.',
  win: 'You win!',
  push: 'Push. Your bet is returned.',
  lose: 'Dealer wins.',
  bust: 'Bust! Dealer wins.',
};

export { DEAL_LOCK_MS } from '../useDealLock';

export function Blackjack() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(50);
  const [round, setRound] = useState<Round | null>(null);
  const { locked, lock } = useDealLock();

  const inRound = round !== null && !round.over;

  const apply = (next: Round) => {
    setRound(next);
    if (next.over) settle(next.returned);
  };

  const deal = () => {
    if (!wager(bet)) return;
    const next = dealRound(round?.deck ?? shuffle(newDeck()), bet);
    apply(next);
    if (!next.over) lock();
  };

  const act = (next: (r: Round) => Round) => {
    if (locked || !round) return;
    apply(next(round));
  };

  const double = () => {
    if (locked || !round || round.player.length !== 2 || round.doubled) return;
    if (!wager(round.bet)) return;
    apply(doubleDown(round));
  };

  const net = round?.over ? round.returned - stakeOf(round) : 0;

  return (
    <section className="table">
      <div className="hand">
        <h3>
          Dealer
          {round && (round.over || round.dealer.length > 0) && !(!round.over && round.dealer.length > 1)
            ? ` · ${handValue(round.dealer).total}`
            : ''}
        </h3>
        <div className="cards">
          {round?.dealer.map((card, i) => (
            <CardView key={i} card={card} faceDown={!round.over && i === 1} />
          ))}
        </div>
      </div>

      <div className="hand">
        <h3>You{round ? ` · ${handValue(round.player).total}` : ''}</h3>
        <div className="cards">
          {round?.player.map((card, i) => (
            <CardView key={i} card={card} />
          ))}
        </div>
      </div>

      {round?.over && (
        <p className="result">
          {OUTCOME_TEXT[round.outcome!]}{' '}
          <span className={net >= 0 ? 'gain' : 'loss'}>
            {net >= 0 ? `+${net}` : net} coins
          </span>
        </p>
      )}

      <div className="actions">
        {!inRound && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {round ? 'Deal again' : 'Deal'}
          </button>
        )}
        {inRound && round && (
          <>
            <button className="primary" onClick={() => act(hit)} disabled={locked}>
              Hit
            </button>
            <button onClick={() => act(stand)} disabled={locked}>
              Stand
            </button>
            <button onClick={double} disabled={locked || round.player.length !== 2 || balance < round.bet}>
              Double
            </button>
          </>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={inRound} />
    </section>
  );
}
