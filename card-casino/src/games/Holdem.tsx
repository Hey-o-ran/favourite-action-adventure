import { useEffect, useState } from 'react';
import { useWallet } from '../wallet';
import { useWinMark } from '../bigWins';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { handText, useI18n, type MessageKey } from '../i18n';
import { BIG_BLIND, BUY_IN, SEAT_COUNT, act, legalActions, startHand, type Action, type HoldemState } from './holdemRules';
import { botAction } from './holdemBots';
import { describeResult, formatLog, nextHandSetup, seatName } from './holdemTable';

/** How long a bot "thinks", so you can follow what it did. */
const BOT_DELAY_MS = 700;

export function Holdem() {
  const { balance, wager, settle } = useWallet();
  const { markWin } = useWinMark();
  const { t, tx } = useI18n();
  /** Null while you're not sitting at the table. */
  const [hand, setHand] = useState<HoldemState | null>(null);
  const [notice, setNotice] = useState('');

  // The bots take their turns a moment apart.
  useEffect(() => {
    if (!hand || hand.over || hand.toAct === null || hand.toAct === 0) return;
    const seat = hand.toAct;
    const timer = window.setTimeout(
      () => setHand((h) => (h && !h.over && h.toAct === seat ? act(h, botAction(h)) : h)),
      BOT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [hand]);

  const sitDown = () => {
    if (!wager(BUY_IN)) return;
    setNotice('');
    setHand(startHand(Array(SEAT_COUNT).fill(BUY_IN), 0, shuffle(newDeck())));
  };

  const play = (action: Action) => {
    if (hand && hand.toAct === 0) setHand(act(hand, action));
  };

  const next = hand?.over ? nextHandSetup(hand) : null;

  const nextHand = () => {
    if (!next) return;
    const notes = next.rebought.map((seat) => t('holdem.rebought', { who: seatName(seat, t) }));
    setNotice(notes.join(' '));
    setHand(startHand(next.stacks, next.button, shuffle(newDeck())));
  };

  const leave = () => {
    if (!hand?.over) return;
    const chips = hand.seats[0].stack;
    // You won this hand with a royal or straight flush.
    if (hand.winners.includes(0)) {
      if (hand.handNames[0] === 'Royal Flush') markWin('holdemRoyalFlush');
      else if (hand.handNames[0] === 'Straight Flush') markWin('holdemStraightFlush');
    }
    settle(chips);
    setHand(null);
    setNotice(
      next?.humanBust
        ? t(chips === 1 ? 'holdem.leftBustOne' : 'holdem.leftBustMany', { bigBlind: BIG_BLIND, chips })
        : t('holdem.left', { chips }),
    );
  };

  if (!hand) {
    return (
      <section className="table">
        <h2>{t('game.holdem.name')}</h2>
        <p className="blurb">{t('holdem.intro', { buyIn: BUY_IN })}</p>
        {notice && <p className="result">{notice}</p>}
        <div className="actions">
          <button className="primary" onClick={sitDown} disabled={balance < BUY_IN}>
            {t('holdem.sit', { buyIn: BUY_IN })}
          </button>
        </div>
        {balance < BUY_IN && <p className="blurb">{t('holdem.need', { buyIn: BUY_IN })}</p>}
      </section>
    );
  }

  const legal = legalActions(hand);
  const myTurn = hand.toAct === 0;
  const result = hand.over ? describeResult(hand, t) : null;
  const showdown = hand.street === 'showdown';
  const me = hand.seats[0];

  return (
    <section className="table">
      <h2>{t('game.holdem.name')}</h2>

      <div className="holdem-seats">
        {[1, 2].map((i) => (
          <Seat key={i} hand={hand} seat={i} faceUp={showdown && !hand.seats[i].folded} />
        ))}
      </div>

      <div className="holdem-board">
        <p className="hand-label">
          {tx('holdem.pot', {
            street: t(`street.${hand.street}` as MessageKey),
            pot: <span className="gain">{hand.pot}</span>,
          })}
        </p>
        <div className="cards">
          {Array.from({ length: 5 }, (_, i) => (hand.board[i] ? <CardView key={i} card={hand.board[i]} /> : <div key={i} className="slot" />))}
        </div>
      </div>

      <Seat hand={hand} seat={0} faceUp />

      <p className="result">
        {result && (
          <>
            {result.text}{' '}
            {result.net > 0 && <span className="gain">{t('game.gain', { amount: result.net })}</span>}
            {result.net < 0 && <span className="loss">{t('game.loss', { amount: Math.abs(result.net) })}</span>}
            {result.net === 0 && <>{t('holdem.even')}</>}
          </>
        )}
        {!result && myTurn && <>{t('holdem.yourTurn')}</>}
        {!result && !myTurn && <>{t('holdem.thinking', { who: seatName(hand.toAct!, t) })}</>}
        {notice && <> {notice}</>}
      </p>

      <div className="actions">
        {!hand.over && (
          <>
            <button onClick={() => play('fold')} disabled={!myTurn || !legal.fold}>
              {t('holdem.fold')}
            </button>
            {legal.check || !myTurn ? (
              <button className="primary" onClick={() => play('check')} disabled={!myTurn || !legal.check}>
                {t('holdem.check')}
              </button>
            ) : (
              <button className="primary" onClick={() => play('call')} disabled={!myTurn || !legal.call}>
                {t('holdem.call', { amount: legal.callAmount })}
                {legal.callAmount >= me.stack && t('holdem.callAllIn')}
              </button>
            )}
            <button onClick={() => play('raise')} disabled={!myTurn || !legal.raise}>
              {hand.currentBet === 0 ? t('holdem.bet') : t('holdem.raiseTo')} {legal.raiseTo || ''}
            </button>
            <button
              className="all-in"
              onClick={() => play('allin')}
              disabled={!myTurn || !legal.allIn}
              title={legal.allInTo >= me.stack + me.bet ? t('holdem.allInEvery') : t('holdem.allInMost')}
            >
              {t('holdem.allIn')} {myTurn && legal.allIn ? `(${legal.allInTo})` : ''}
            </button>
          </>
        )}
        {hand.over && !next?.humanBust && (
          <button className="primary" onClick={nextHand}>
            {t('holdem.next')}
          </button>
        )}
        <button onClick={leave} disabled={!hand.over} title={hand.over ? undefined : t('holdem.leaveTitle')}>
          {t('holdem.leave', { stack: me.stack })}
        </button>
      </div>

      <ul className="holdem-log" aria-label={t('holdem.logLabel')}>
        {formatLog(hand.log, t).slice(-6).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function Seat({ hand, seat, faceUp }: { hand: HoldemState; seat: number; faceUp: boolean }) {
  const { t } = useI18n();
  const s = hand.seats[seat];
  const active = hand.toAct === seat;
  const winner = hand.over && hand.winners.includes(seat);
  const handName = hand.handNames[seat];
  return (
    <div className={['holdem-seat', active && 'active', s.folded && 'folded', winner && 'winner'].filter(Boolean).join(' ')}>
      <p className="hand-label">
        {seatName(seat, t)}
        {hand.button === seat && <span className="dealer-chip" title={t('holdem.dealerButton')}>D</span>}
        {' · '}
        {t('holdem.seatCoins', { stack: s.stack })}
        {s.bet > 0 && <> · {t('holdem.seatBet', { bet: s.bet })}</>}
        {s.folded && <> · {t('holdem.seatFolded')}</>}
        {handName && <span className="gain"> · {handText(t, handName)}</span>}
      </p>
      <div className="cards">
        {s.hole.map((card, i) => (
          <CardView key={i} card={card} faceDown={!faceUp} />
        ))}
      </div>
    </div>
  );
}
