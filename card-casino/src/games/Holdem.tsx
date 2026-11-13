import { useEffect, useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle } from '../cards';
import { CardView } from '../components/CardView';
import { BIG_BLIND, BUY_IN, SEAT_COUNT, act, legalActions, startHand, type Action, type HoldemState } from './holdemRules';
import { botAction } from './holdemBots';
import { describeResult, formatLog, nextHandSetup, seatName } from './holdemTable';

/** How long a bot "thinks", so you can follow what it did. */
const BOT_DELAY_MS = 700;

export function Holdem() {
  const { balance, wager, settle } = useWallet();
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
    const notes = next.rebought.map((seat) => `${seatName(seat)} bought back in.`);
    setNotice(notes.join(' '));
    setHand(startHand(next.stacks, next.button, shuffle(newDeck())));
  };

  const leave = () => {
    if (!hand?.over) return;
    const chips = hand.seats[0].stack;
    settle(chips);
    setHand(null);
    setNotice(
      next?.humanBust
        ? `You can't cover the big blind (${BIG_BLIND}), so you left the table with ${chips} ${chips === 1 ? 'coin' : 'coins'}.`
        : `You left the table with ${chips} coins.`,
    );
  };

  if (!hand) {
    return (
      <section className="table">
        <h2>Texas Hold'em</h2>
        <p className="blurb">
          Sit down with {BUY_IN} coins against two bots. Any chips you have left when you leave go back to your balance.
        </p>
        {notice && <p className="result">{notice}</p>}
        <div className="actions">
          <button className="primary" onClick={sitDown} disabled={balance < BUY_IN}>
            Sit down ({BUY_IN} coins)
          </button>
        </div>
        {balance < BUY_IN && <p className="blurb">You need at least {BUY_IN} coins to sit down.</p>}
      </section>
    );
  }

  const legal = legalActions(hand);
  const myTurn = hand.toAct === 0;
  const result = hand.over ? describeResult(hand) : null;
  const showdown = hand.street === 'showdown';
  const me = hand.seats[0];

  return (
    <section className="table">
      <h2>Texas Hold'em</h2>

      <div className="holdem-seats">
        {[1, 2].map((i) => (
          <Seat key={i} hand={hand} seat={i} faceUp={showdown && !hand.seats[i].folded} />
        ))}
      </div>

      <div className="holdem-board">
        <p className="hand-label">
          {hand.street === 'showdown' ? 'Showdown' : hand.street[0].toUpperCase() + hand.street.slice(1)} · Pot{' '}
          <span className="gain">{hand.pot}</span>
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
            {result.net > 0 && <span className="gain">+{result.net} coins</span>}
            {result.net < 0 && <span className="loss">{result.net} coins</span>}
            {result.net === 0 && <>You break even.</>}
          </>
        )}
        {!result && myTurn && <>Your turn.</>}
        {!result && !myTurn && <>{seatName(hand.toAct!)} is thinking…</>}
        {notice && <> {notice}</>}
      </p>

      <div className="actions">
        {!hand.over && (
          <>
            <button onClick={() => play('fold')} disabled={!myTurn || !legal.fold}>
              Fold
            </button>
            {legal.check || !myTurn ? (
              <button className="primary" onClick={() => play('check')} disabled={!myTurn || !legal.check}>
                Check
              </button>
            ) : (
              <button className="primary" onClick={() => play('call')} disabled={!myTurn || !legal.call}>
                Call {legal.callAmount}
                {legal.callAmount >= me.stack && ' (all in)'}
              </button>
            )}
            <button onClick={() => play('raise')} disabled={!myTurn || !legal.raise}>
              {hand.currentBet === 0 ? 'Bet' : 'Raise to'} {legal.raiseTo || ''}
            </button>
            <button
              className="all-in"
              onClick={() => play('allin')}
              disabled={!myTurn || !legal.allIn}
              title={
                legal.allInTo >= me.stack + me.bet
                  ? 'Bet every chip you have'
                  : 'Bet the most the other players can match. You keep the rest.'
              }
            >
              All in {myTurn && legal.allIn ? `(${legal.allInTo})` : ''}
            </button>
          </>
        )}
        {hand.over && !next?.humanBust && (
          <button className="primary" onClick={nextHand}>
            Next hand
          </button>
        )}
        <button onClick={leave} disabled={!hand.over} title={hand.over ? undefined : 'Finish the hand first, or fold'}>
          Leave table ({me.stack})
        </button>
      </div>

      <ul className="holdem-log" aria-label="What happened this hand">
        {formatLog(hand.log).slice(-6).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function Seat({ hand, seat, faceUp }: { hand: HoldemState; seat: number; faceUp: boolean }) {
  const s = hand.seats[seat];
  const active = hand.toAct === seat;
  const winner = hand.over && hand.winners.includes(seat);
  return (
    <div className={['holdem-seat', active && 'active', s.folded && 'folded', winner && 'winner'].filter(Boolean).join(' ')}>
      <p className="hand-label">
        {seatName(seat)}
        {hand.button === seat && <span className="dealer-chip" title="Dealer button">D</span>}
        {' · '}
        {s.stack} coins
        {s.bet > 0 && <> · bet {s.bet}</>}
        {s.folded && <> · folded</>}
        {hand.handNames[seat] && <span className="gain"> · {hand.handNames[seat]}</span>}
      </p>
      <div className="cards">
        {s.hole.map((card, i) => (
          <CardView key={i} card={card} faceDown={!faceUp} />
        ))}
      </div>
    </div>
  );
}
