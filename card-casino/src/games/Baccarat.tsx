import { useState } from 'react';
import { useWallet } from '../wallet';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { useI18n, type MessageKey } from '../i18n';
import { handTotal, newShoe, playBaccarat, type BaccaratRound, type BaccaratSide } from './baccaratRules';

const SIDES: { id: BaccaratSide; label: MessageKey; pays: MessageKey }[] = [
  { id: 'player', label: 'baccarat.player', pays: 'baccarat.paysPlayer' },
  { id: 'banker', label: 'baccarat.banker', pays: 'baccarat.paysBanker' },
  { id: 'tie', label: 'baccarat.tie', pays: 'baccarat.paysTie' },
];

const WINNER_KEY: Record<BaccaratSide, MessageKey> = {
  player: 'baccarat.player',
  banker: 'baccarat.banker',
  tie: 'baccarat.tie',
};

export function Baccarat() {
  const { balance, wager, settle } = useWallet();
  const { t } = useI18n();
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
      <h2>{t('game.baccarat.name')}</h2>

      <div className="side-picker" role="group" aria-label={t('baccarat.betOn')}>
        {SIDES.map((s) => (
          <button key={s.id} className={s.id === side ? 'primary' : undefined} onClick={() => setSide(s.id)} aria-pressed={s.id === side}>
            {t(s.label)} <small>({t(s.pays)})</small>
          </button>
        ))}
      </div>

      {(['player', 'banker'] as const).map((who) => (
        <div className="hand" key={who}>
          <p className="hand-label">
            {t(WINNER_KEY[who])}
            {round && <> · {handTotal(round[who])}</>}
            {round?.winner === who && <span className="gain"> · {t('baccarat.wins')}</span>}
          </p>
          <div className="cards">
            {round ? round[who].map((card, i) => <CardView key={i} card={card} />) : <div className="slot" />}
          </div>
        </div>
      ))}

      {round && (
        <p className="result">
          {round.winner === 'tie' ? t('baccarat.tieResult') : t('baccarat.winsResult', { side: t(WINNER_KEY[round.winner]) })}
          {round.natural && ` ${t('baccarat.natural')}`}{' '}
          {net > 0 && <span className="gain">{t('game.gain', { amount: net })}</span>}
          {net === 0 && <>{t('baccarat.returned')}</>}
          {net < 0 && <span className="loss">{t('game.loss', { amount: round.bet })}</span>}
        </p>
      )}

      <div className="actions">
        <button className="primary" onClick={deal} disabled={balance < bet}>
          {round ? t('game.dealAgain') : t('game.deal')}
        </button>
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} />
    </section>
  );
}
