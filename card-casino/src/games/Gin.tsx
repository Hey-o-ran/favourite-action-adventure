import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { newDeck, shuffle, type Card } from '../cards';
import { useDealLock } from '../useDealLock';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import { useI18n, type MessageKey, type Translate } from '../i18n';
import { useGameSettings } from '../gameSettings';
import { SettingsPanel } from '../components/SettingsPanel';
import { GIN_SETTINGS, ginChoices } from './ginSettings';
import { ginLog } from './gameLogs';
import { botStep } from './ginBot';
import {
  DEFAULT_RULES,
  HAND_BONUS,
  MATCH_BONUS,
  PAYOUT_BY_DIFFICULTY,
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
/** Describes how a hand ended, for the screen. */
function describeResult(r: HandResult, t: Translate): string {
  const name = (who: Who) => t(who === 'player' ? 'gin.name.you' : 'gin.name.bot');
  if (r.kind === 'draw') return t('gin.res.draw');
  const knocker = r.knocker!;
  const them = other(knocker);
  if (r.kind === 'gin')
    return t('gin.res.gin', { knocker: name(knocker), other: name(them), otherPoints: r.otherPoints!, bonus: r.bonus, points: r.points });
  const laid =
    r.laidOff!.length > 0 ? t('gin.res.laid', { other: name(them), cards: r.laidOff!.map(cardName).join(' ') }) : '';
  if (r.kind === 'undercut')
    return t('gin.res.undercut', {
      knocker: name(knocker),
      knockerPoints: r.knockerPoints!,
      laid,
      other: name(them),
      otherPoints: r.otherPoints!,
      diff: r.knockerPoints! - r.otherPoints!,
      bonus: r.bonus,
      points: r.points,
    });
  return t('gin.res.knock', { knocker: name(knocker), knockerPoints: r.knockerPoints!, laid, other: name(them), otherPoints: r.otherPoints!, points: r.points });
}

export function Gin() {
  const { balance, wager, settle } = useWallet();
  const { t, tx, lang } = useI18n();
  const [bet, setBet] = useState(50);
  const [match, setMatch] = useState<GinMatch | null>(null);
  /** The card you've picked to discard. */
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmingForfeit, setConfirmingForfeit] = useState(false);
  const settled = useRef(true);
  const { locked, lock } = useDealLock();
  const { values: settingValues, set: setSetting, reset: resetSettings } = useGameSettings(GIN_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  /** What the next match will be played with. A match in progress keeps the settings it started with. */
  const choices = ginChoices(settingValues);

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
    setMatch(startMatch(shuffle(newDeck()), bet, Math.random() < 0.5 ? 'player' : 'bot', { rules: choices.rules, difficulty: choices.difficulty }));
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
    const timer = window.setTimeout(() => setMatch((m) => (m ? updateHand(m, botStep(m.hand, m.difficulty)) : m)), BOT_DELAY_MS);
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
          <div className="meld" key={i} aria-label={t('gin.meld')}>
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
      <h2>{t('game.gin-rummy.name')}</h2>

      {match && hand ? (
        <>
          <p className="scoreboard" aria-label={t('gin.scoreLabel')}>
            {tx('gin.score', {
              hand: match.handNumber,
              you: <b>{match.scores.player}</b>,
              bot: <b>{match.scores.bot}</b>,
              target: match.rules.target,
              dealer: t(hand.dealer === 'player' ? 'gin.youDeal' : 'gin.botDeals'),
            })}
          </p>
          <p className="hint gin-summary">
            {t('gin.summary', {
              difficulty: t(`settings.gin.difficulty.${match.difficulty}` as MessageKey),
              target: match.rules.target,
              knock: t(`gin.short.${match.rules.knockRule}` as MessageKey),
              extra: match.rules.ginBonus > DEFAULT_RULES.ginBonus ? t('gin.summary.double') : '',
            })}
          </p>

          <p className="hand-label">{t('gin.botHand', { count: hand.bot.length })}</p>
          {renderGroups('bot', !handOver)}

          <div className="pile-row">
            <div className="pile">
              <CardView faceDown />
              <small>{t('gin.stock', { count: hand.stock.length })}</small>
            </div>
            <div className="pile">
              {hand.discard.length > 0 ? <CardView card={topDiscard(hand)} /> : <div className="slot" />}
              <small>{t('gin.pile')}</small>
            </div>
          </div>

          <p className="hand-label">
            {t('gin.youHand', { count: hand.player.length })}
            {playerPoints !== null && <>{t('gin.loose', { points: playerPoints })}</>}
            {playerPoints !== null && <>{hand.knockLimit === 0 ? t('gin.limitGinOnly') : t('gin.limitNote', { limit: hand.knockLimit })}</>}
          </p>
          {renderGroups('player', false)}
        </>
      ) : (
        <div className="cards">
          <div className="slot" />
        </div>
      )}

      <p className="result">
        {hand && !handOver && <>{ginLog(hand.log, lang, t)} </>}
        {botTurn && <>{t('gin.thinking')}</>}
        {handOver && hand!.result && (
          <>
            {hand!.result.kind === 'draw' && <>{ginLog(hand!.log, lang, t)} </>}
            {describeResult(hand!.result, t)}
          </>
        )}
        {match?.status === 'won' && (
          <>
            {' '}
            {tx('gin.youWinMatch', { gain: <span className="gain">{t('game.gain', { amount: returnedFor(match) - match.bet })}</span> })}
          </>
        )}
        {match?.status === 'lost' && (
          <>
            {' '}
            {tx(match.forfeited ? 'gin.youForfeited' : 'gin.botWinsMatch', {
              loss: <span className="loss">{t('game.loss', { amount: match.bet })}</span>,
            })}
          </>
        )}
      </p>

      {match?.final && (
        <p className="final-score">
          {t('gin.final', {
            youTotal: match.final.player,
            youHands: match.scores.player,
            handBonus: HAND_BONUS,
            youWon: match.handsWon.player,
            youMatch: match.status === 'won' ? t('gin.matchBonus', { bonus: MATCH_BONUS }) : '',
            botTotal: match.final.bot,
            botHands: match.scores.bot,
            botWon: match.handsWon.bot,
            botMatch: match.status === 'lost' ? t('gin.matchBonus', { bonus: MATCH_BONUS }) : '',
          })}
        </p>
      )}

      <div className="actions">
        {myTurn && hand!.phase === 'offer' && (
          <>
            <button className="primary" onClick={() => move(takeUpcard)} disabled={locked}>
              {t('gin.take', { card: cardName(topDiscard(hand!)) })}
            </button>
            <button onClick={() => move(passUpcard)} disabled={locked}>
              {t('gin.pass')}
            </button>
          </>
        )}
        {myTurn && hand!.phase === 'draw' && (
          <>
            <button className="primary" onClick={() => move(drawFromStock)} disabled={locked}>
              {t('gin.drawStock')}
            </button>
            <button onClick={() => move(drawFromPile)} disabled={locked || mustDrawStock(hand!)}>
              {t('gin.take', { card: cardName(topDiscard(hand!)) })}
            </button>
          </>
        )}
        {myTurn && hand!.phase === 'discard' && (
          <>
            <button className="primary" onClick={() => move((h) => discardCard(h, selectedIndex))} disabled={selectedIndex < 0}>
              {selectedIndex >= 0 ? t('gin.discard', { card: cardName(hand!.player[selectedIndex]) }) : t('gin.pick')}
            </button>
            <button
              onClick={() => move((h) => knock(h, selectedIndex))}
              disabled={!knockInfo?.allowed}
              title={
                knockInfo && !knockInfo.allowed
                  ? hand!.knockLimit === 0
                    ? t('gin.knockTitleGin', { points: knockInfo.points })
                    : t('gin.knockTitle', { points: knockInfo.points, limit: hand!.knockLimit })
                  : undefined
              }
            >
              {knockInfo?.allowed && knockInfo.points === 0
                ? t('gin.gin')
                : knockInfo
                  ? t('gin.knock', { points: knockInfo.points })
                  : t('gin.knockPlain')}
            </button>
          </>
        )}
        {playing && handOver && (
          <button className="primary" onClick={startNextHand} disabled={locked}>
            {t('gin.next')}
          </button>
        )}
        {!playing && (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {match ? t('game.dealAgain') : t('game.deal')}
          </button>
        )}
      </div>

      {playing && !confirmingForfeit && (
        <div className="actions">
          <button onClick={() => setConfirmingForfeit(true)}>{t('gin.forfeit')}</button>
        </div>
      )}
      {playing && confirmingForfeit && (
        <div className="actions" role="group" aria-label={t('gin.forfeitGroup')}>
          <span>{t('gin.forfeitAsk', { bet: match!.bet })}</span>
          <button
            onClick={() => {
              setMatch((m) => (m ? forfeit(m) : m));
              setConfirmingForfeit(false);
            }}
          >
            {t('gin.yesForfeit')}
          </button>
          <button onClick={() => setConfirmingForfeit(false)}>{t('gin.keepPlaying')}</button>
        </div>
      )}

      <div className="actions">
        <button aria-expanded={showSettings} onClick={() => setShowSettings((s) => !s)}>
          {t(showSettings ? 'settings.hide' : 'settings.show')}
        </button>
      </div>
      {showSettings && <SettingsPanel schema={GIN_SETTINGS} values={settingValues} onChange={setSetting} onReset={resetSettings} />}

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
      <p className="hint">{t('gin.winPays', { multiple: PAYOUT_BY_DIFFICULTY[playing && match ? match.difficulty : choices.difficulty] })}</p>
    </section>
  );
}
