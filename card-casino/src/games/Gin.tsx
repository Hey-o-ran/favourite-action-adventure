import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle, type Card } from '../cards';
import { useDealLock } from '../useDealLock';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { botStep } from './ginBot';
import {
  GIN_BONUS,
  HAND_BONUS,
  MATCH_BONUS,
  MATCH_TARGET,
  UNDERCUT_BONUS,
  arrange,
  cardName,
  discardCard,
  drawFromPile,
  drawFromStock,
  forfeit,
  knock,
  knockOption,
  mustDrawStock,
  nextHand,
  other,
  passUpcard,
  returnedFor,
  startMatch,
  takeUpcard,
  topDiscard,
  updateHand,
  type GinMatch,
  type HandResult,
  type Who,
} from './ginRules';

/** How long the bot "thinks", so you can follow what it did. */
const BOT_DELAY_MS = 900;

const cardKey = (c: Card) => `${c.rank}-${c.suit}`;
const name = (who: Who) => (who === 'player' ? 'You' : 'The bot');

/** Describes how a hand ended, for the screen. */
function describeResult(r: HandResult): string {
  if (r.kind === 'draw') return 'Nobody scores. The hand is a draw.';
  const knocker = r.knocker!;
  const them = other(knocker);
  if (r.kind === 'gin')
    return `${name(knocker)} went gin! ${name(them)} had ${r.otherPoints} left over. ${name(knocker)} scores ${r.otherPoints} + ${GIN_BONUS} bonus = ${r.points}.`;
  const laid = r.laidOff!.length > 0 ? ` ${name(them)} laid off ${r.laidOff!.map(cardName).join(' ')}.` : '';
  if (r.kind === 'undercut')
    return `${name(knocker)} knocked with ${r.knockerPoints}.${laid} ${name(them)} only had ${r.otherPoints}, so it's an undercut! ${name(them)} scores ${r.knockerPoints! - r.otherPoints!} + ${UNDERCUT_BONUS} bonus = ${r.points}.`;
  return `${name(knocker)} knocked with ${r.knockerPoints}.${laid} ${name(them)} had ${r.otherPoints}. ${name(knocker)} scores ${r.points}.`;
}

export function Gin() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(50);
  const [match, setMatch] = useState<GinMatch | null>(null);
  /** The card you've picked to discard. */
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmingForfeit, setConfirmingForfeit] = useState(false);
  const settled = useRef(true);
  const { locked, lock } = useDealLock();

  const hand = match?.hand;
  const playing = match?.status === 'playing';
  const handOver = hand?.phase === 'over';
  const myTurn = !!playing && !handOver && hand!.turn === 'player';
  const botTurn = !!playing && !handOver && hand!.turn === 'bot';

  const deal = () => {
    if (!wager(bet)) return;
    settled.current = false;
    setSelected(null);
    setConfirmingForfeit(false);
    setMatch(startMatch(shuffle(newDeck()), bet, Math.random() < 0.5 ? 'player' : 'bot'));
    lock();
  };

  const startNextHand = () => {
    setMatch((m) => (m ? nextHand(m, shuffle(newDeck())) : m));
    setSelected(null);
    lock();
  };

  // The bot moves a moment after you.
  useEffect(() => {
    if (!match || match.status !== 'playing' || match.hand.phase === 'over' || match.hand.turn !== 'bot') return;
    const timer = window.setTimeout(() => setMatch((m) => (m ? updateHand(m, botStep(m.hand)) : m)), BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [match]);

  // Pay out once, when the match ends.
  useEffect(() => {
    if (!match || match.status === 'playing' || settled.current) return;
    settled.current = true;
    settle(returnedFor(match));
  }, [match, settle]);

  /** Applies one of your moves to the current hand. */
  const move = (change: (h: NonNullable<typeof hand>) => NonNullable<typeof hand>) => {
    if (!match || !myTurn) return;
    setMatch(updateHand(match, change(match.hand)));
    setSelected(null);
  };

  const selectedIndex = hand && selected ? hand.player.findIndex((c) => cardKey(c) === selected) : -1;
  const knockInfo = hand && selectedIndex >= 0 ? knockOption(hand, selectedIndex) : null;

  /** The cards of one side, grouped into melds and loose cards for display. */
  const groupsFor = (who: Who) => {
    const h = match!.hand;
    const r = h.result;
    if (handOver && r && r.kind !== 'draw') {
      return who === r.knocker ? { melds: r.knockerMelds!, loose: r.knockerDeadwood! } : { melds: r.otherMelds!, loose: r.otherDeadwood! };
    }
    const a = arrange(h[who]);
    return { melds: a.melds, loose: a.deadwood };
  };

  const renderGroups = (who: Who, faceDown: boolean) => {
    if (faceDown) {
      return (
        <div className="cards">
          {match!.hand.bot.map((_, i) => (
            <CardView key={i} faceDown />
          ))}
        </div>
      );
    }
    const { melds, loose } = groupsFor(who);
    const canPick = who === 'player' && myTurn && hand!.phase === 'discard';
    const card = (c: Card) => {
      const blocked = hand!.taken && cardKey(hand!.taken) === cardKey(c);
      return (
        <CardView
          key={cardKey(c)}
          card={c}
          selected={who === 'player' && selected === cardKey(c)}
          onClick={canPick && !blocked ? () => setSelected((s) => (s === cardKey(c) ? null : cardKey(c))) : undefined}
        />
      );
    };
    return (
      <div className="gin-hand">
        {melds.map((meld, i) => (
          <div className="meld" key={i} aria-label="Meld">
            {meld.map(card)}
          </div>
        ))}
        {loose.length > 0 && <div className="loose">{loose.map(card)}</div>}
      </div>
    );
  };

  const playerPoints = hand && !handOver ? arrange(hand.player).points : null;

  return (
    <section className="table">
      <h2>Gin Rummy</h2>

      {match && hand ? (
        <>
          <p className="scoreboard" aria-label="Score">
            Hand {match.handNumber} · You <b>{match.scores.player}</b> – Bot <b>{match.scores.bot}</b> · first to {MATCH_TARGET} wins · {hand.dealer === 'player' ? 'You deal' : 'Bot deals'}
          </p>

          <p className="hand-label">Bot · {hand.bot.length} cards</p>
          {renderGroups('bot', !handOver)}

          <div className="pile-row">
            <div className="pile">
              <CardView faceDown />
              <small>{hand.stock.length} in stock</small>
            </div>
            <div className="pile">
              {hand.discard.length > 0 ? <CardView card={topDiscard(hand)} /> : <div className="slot" />}
              <small>Pile</small>
            </div>
          </div>

          <p className="hand-label">
            You · {hand.player.length} cards{playerPoints !== null && <> · {playerPoints} loose points</>}
          </p>
          {renderGroups('player', false)}
        </>
      ) : (
        <div className="cards">
          <div className="slot" />
        </div>
      )}

      <p className="result">
        {hand && !handOver && <>{hand.log} </>}
        {botTurn && <>The bot is thinking…</>}
        {handOver && hand!.result && (
          <>
            {hand!.result.kind === 'draw' && <>{hand!.log} </>}
            {describeResult(hand!.result)}
          </>
        )}
        {match?.status === 'won' && (
          <>
            {' '}
            You win the match! <span className="gain">+{returnedFor(match) - match.bet} coins</span>
          </>
        )}
        {match?.status === 'lost' && (
          <>
            {' '}
            {match.forfeited ? 'You forfeited the match.' : 'The bot wins the match.'} <span className="loss">-{match.bet} coins</span>
          </>
        )}
      </p>

      {match?.final && (
        <p className="final-score">
          Final score: You {match.final.player} (hands {match.scores.player} + {HAND_BONUS} × {match.handsWon.player} hands won
          {match.status === 'won' ? ` + ${MATCH_BONUS} for the match` : ''}) · Bot {match.final.bot} (hands {match.scores.bot} + {HAND_BONUS} × {match.handsWon.bot} hands won
          {match.status === 'lost' ? ` + ${MATCH_BONUS} for the match` : ''})
        </p>
      )}

      <div className="actions">
        {myTurn && hand!.phase === 'offer' && (
          <>
            <button className="primary" onClick={() => move(takeUpcard)} disabled={locked}>
              Take the {cardName(topDiscard(hand!))}
            </button>
            <button onClick={() => move(passUpcard)} disabled={locked}>
              Pass
            </button>
          </>
        )}
        {myTurn && hand!.phase === 'draw' && (
          <>
            <button className="primary" onClick={() => move(drawFromStock)} disabled={locked}>
              Draw from the stock
            </button>
            <button onClick={() => move(drawFromPile)} disabled={locked || mustDrawStock(hand!)}>
              Take the {cardName(topDiscard(hand!))}
            </button>
          </>
        )}
        {myTurn && hand!.phase === 'discard' && (
          <>
            <button className="primary" onClick={() => move((h) => discardCard(h, selectedIndex))} disabled={selectedIndex < 0}>
              {selectedIndex >= 0 ? `Discard the ${cardName(hand!.player[selectedIndex])}` : 'Pick a card to discard'}
            </button>
            <button
              onClick={() => move((h) => knock(h, selectedIndex))}
              disabled={!knockInfo?.allowed}
              title={knockInfo && !knockInfo.allowed ? `You'd have ${knockInfo.points} left over. You need 10 or fewer to knock.` : undefined}
            >
              {knockInfo?.allowed && knockInfo.points === 0 ? 'Gin!' : knockInfo ? `Knock (${knockInfo.points} left)` : 'Knock'}
            </button>
          </>
        )}
        {playing && handOver && (
          <button className="primary" onClick={startNextHand} disabled={locked}>
            Next hand
          </button>
        )}
        {!playing && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {match ? 'Deal again' : 'Deal'}
          </button>
        )}
      </div>

      {playing && !confirmingForfeit && (
        <div className="actions">
          <button onClick={() => setConfirmingForfeit(true)}>Forfeit match</button>
        </div>
      )}
      {playing && confirmingForfeit && (
        <div className="actions" role="group" aria-label="Forfeit the match">
          <span>Give up and lose your {match!.bet} coins?</span>
          <button
            onClick={() => {
              setMatch((m) => (m ? forfeit(m) : m));
              setConfirmingForfeit(false);
            }}
          >
            Yes, forfeit
          </button>
          <button onClick={() => setConfirmingForfeit(false)}>Keep playing</button>
        </div>
      )}

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
    </section>
  );
}
