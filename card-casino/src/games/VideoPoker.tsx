import { useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { handText, useI18n } from '../i18n';
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
  const { t } = useI18n();
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
      <h2>{t('game.video-poker.name')}</h2>

      <div className="cards">
        {round?.hand.map((card, i) => (
          <div className="hold-col" key={i}>
            <CardView card={card} selected={inRound && round.held[i]} />
            {inRound && (
              <button
                className={`hold-btn${round.held[i] ? ' on' : ''}`}
                onClick={() => setRound(toggleHold(round, i))}
              >
                {round.held[i] ? t('poker.held') : t('poker.hold')}
              </button>
            )}
          </div>
        ))}
      </div>

      {result && (
        <p className="result">
          {result.multiplier > 0 ? (
            <>
              {handText(t, result.name)} ·{' '}
              <span className="gain">{t('game.gain', { amount: round!.bet * result.multiplier - round!.bet })}</span>
            </>
          ) : (
            <>
              {t('hand.No win')} · <span className="loss">{t('game.loss', { amount: round!.bet })}</span>
            </>
          )}
        </p>
      )}

      <div className="actions">
        {!inRound && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {round ? t('game.dealAgain') : t('game.deal')}
          </button>
        )}
        {inRound && (
          <button className="primary" onClick={draw}>
            {t('poker.draw')}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={inRound} />

      <div className="paytable">
        <table>
          <thead>
            <tr>
              <th>{t('poker.hand')}</th>
              <th>{t('poker.pays')}</th>
            </tr>
          </thead>
          <tbody>
            {PAYTABLE.map((row) => (
              <tr key={row.name} className={row.name === result?.name ? 'hit' : undefined}>
                <td>{handText(t, row.name)}</td>
                <td>{t('poker.multiplier', { n: row.multiplier })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
