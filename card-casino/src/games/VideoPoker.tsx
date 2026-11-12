import { useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import {
  PAYTABLE,
  dealVideoPoker,
  drawReplacements,
  evaluateHand,
  toggleHold,
  type VideoPokerRound,
} from './videoPokerRules';

export function VideoPoker() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  const [round, setRound] = useState<VideoPokerRound | null>(null);

  const inRound = round !== null && !round.drawn;
  const result = round?.drawn ? evaluateHand(round.hand) : null;

  const deal = () => {
    if (!wager(bet)) return;
    // Fresh shuffle every hand, as in a real machine: no leftover deck, no duplicate cards.
    setRound(dealVideoPoker(shuffle(newDeck()), bet));
  };

  const draw = () => {
    if (!round || round.drawn) return;
    const next = drawReplacements(round);
    setRound(next);
    settle(round.bet * evaluateHand(next.hand).multiplier);
  };

  return (
    <section className="table">
      <h2>Jacks or Better</h2>

      <div className="cards">
        {round?.hand.map((card, i) => (
          <div className="hold-col" key={i}>
            <CardView card={card} selected={inRound && round.held[i]} />
            {inRound && (
              <button
                className={`hold-btn${round.held[i] ? ' on' : ''}`}
                onClick={() => setRound(toggleHold(round, i))}
              >
                {round.held[i] ? 'Held' : 'Hold'}
              </button>
            )}
          </div>
        ))}
      </div>

      {result && (
        <p className="result">
          {result.multiplier > 0 ? (
            <>
              {result.name} · <span className="gain">+{round!.bet * result.multiplier - round!.bet} coins</span>
            </>
          ) : (
            <>
              No win · <span className="loss">-{round!.bet} coins</span>
            </>
          )}
        </p>
      )}

      <div className="actions">
        {!inRound && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {round ? 'Deal again' : 'Deal'}
          </button>
        )}
        {inRound && (
          <button className="primary" onClick={draw}>
            Draw
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={inRound} />

      <div className="paytable">
        <table>
          <thead>
            <tr>
              <th>Hand</th>
              <th>Pays</th>
            </tr>
          </thead>
          <tbody>
            {PAYTABLE.map((row) => (
              <tr key={row.name} className={row.name === result?.name ? 'hit' : undefined}>
                <td>{row.name}</td>
                <td>{row.multiplier}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
