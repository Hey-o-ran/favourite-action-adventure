import { useState } from 'react';
import { useWallet } from '../wallet';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { handTotal, newShoe, playBaccarat, type BaccaratRound, type BaccaratSide } from './baccaratRules';

const SIDES: { id: BaccaratSide; label: string; pays: string }[] = [
  { id: 'player', label: 'Player', pays: '1 to 1' },
  { id: 'banker', label: 'Banker', pays: '0.95 to 1' },
  { id: 'tie', label: 'Tie', pays: '8 to 1' },
];

const WINNER_LABEL: Record<BaccaratSide, string> = { player: 'Player', banker: 'Banker', tie: 'Tie' };

export function Baccarat() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  const [side, setSide] = useState<BaccaratSide>('banker');
  const [round, setRound] = useState<BaccaratRound | null>(null);

  const deal = () => {
    if (!wager(bet)) return;
    // A brand-new shuffled shoe every round, so earlier hands tell you nothing.
    const next = playBaccarat(newShoe(), side, bet);
    setRound(next);
    settle(next.returned);
  };

  const net = round ? round.returned - round.bet : 0;

  return (
    <section className="table">
      <h2>Baccarat</h2>

      <div className="side-picker" role="group" aria-label="Place your bet on">
        {SIDES.map((s) => (
          <button key={s.id} className={s.id === side ? 'primary' : undefined} onClick={() => setSide(s.id)} aria-pressed={s.id === side}>
            {s.label} <small>({s.pays})</small>
          </button>
        ))}
      </div>

      {(['player', 'banker'] as const).map((who) => (
        <div className="hand" key={who}>
          <p className="hand-label">
            {WINNER_LABEL[who]}
            {round && <> · {handTotal(round[who])}</>}
            {round?.winner === who && <span className="gain"> · wins</span>}
          </p>
          <div className="cards">
            {round ? round[who].map((card, i) => <CardView key={i} card={card} />) : <div className="slot" />}
          </div>
        </div>
      ))}

      {round && (
        <p className="result">
          {round.winner === 'tie' ? 'Tie.' : `${WINNER_LABEL[round.winner]} wins.`}
          {round.natural && ' Natural, so no more cards.'}{' '}
          {net > 0 && <span className="gain">+{net} coins</span>}
          {net === 0 && <>Bet returned.</>}
          {net < 0 && <span className="loss">-{round.bet} coins</span>}
        </p>
      )}

      <div className="actions">
        <button className="primary" onClick={deal} disabled={balance < bet}>
          {round ? 'Deal again' : 'Deal'}
        </button>
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} />
    </section>
  );
}
