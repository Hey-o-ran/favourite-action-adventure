import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { useI18n } from '../i18n';
import { translateEngine } from './shengjiText';
import { shuffle } from '../cards';
import { useDealLock } from '../useDealLock';
import { BetPanel } from '../components/BetPanel';
import { ShengjiCardView } from '../components/ShengjiCardView';
import { domainOf, makeDeck, sortHand, totalPoints, type Domain, type SCard, type Trump } from './shengjiCards';
import { ATTACK_TARGET, KITTY_SIZE, levelLabel, nextHand, teamOf, type Standing } from './shengjiScoring';
import { attackingTeam, botCards, payoutFor, playCards, type HandState } from './shengjiTable';
import { botBury, buryKitty, dealOne, declare, declarerCards, startOpening, type Opening } from './shengjiOpening';

/*
 * The Shengji (80 Points) table: the deal (where you can declare trump by showing a level card), the kitty, and the
 * play against bots. The rules engine's messages are in English and are translated here by `translateEngine`.
 */

/** How long each card takes to deal, so you have time to declare as the level cards arrive. */
export const DEAL_MS = 40;

/** How long a bot takes to play, so you can follow the trick. */
export const BOT_DELAY_MS = 700;

const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;

/** Where a seat sits on the screen, from the player's point of view. */
const PLACE = ['bottom', 'left', 'top', 'right'] as const;

/** The message for how a hand ended: which side won, and how many levels they moved up (0 means they take over the deal). */
function resultKey(mine: boolean, levels: number) {
  const side = mine ? 'you' : 'other';
  const what = levels === 0 ? 'Take' : levels === 1 ? 'Up1' : 'UpN';
  return `shengji.result.${side}${what}` as 'shengji.result.youUp1';
}

export function Shengji() {
  const { t, tx } = useI18n();
  const seatName = (seat: number) => t(`shengji.seat.${seat}` as 'shengji.seat.0');
  const domainName = (d: Domain) => t(`shengji.domain.${d}` as 'shengji.domain.trump');
  const trumpText = (trump: Trump) =>
    trump.suit === null ? t('shengji.trump.none', { level: levelLabel(trump.level) }) : t('shengji.trump.suit', { suit: SUIT_SYMBOL[trump.suit], level: levelLabel(trump.level) });
  const fail = (message: string) => setError(translateEngine(message, t));
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(50);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [hand, setHand] = useState<HandState | null>(null);
  /** The deal and kitty, until the hand is ready to play. */
  const [opening, setOpening] = useState<Opening | null>(null);
  /** The coins staked on the hand being played. */
  const [staked, setStaked] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState('');
  /** Set when a side has won the whole game, by winning a hand as declarers at ace. */
  const [gameWonBy, setGameWonBy] = useState<0 | 1 | null>(null);
  const settled = useRef(true);
  const { locked, lock } = useDealLock();

  const dealing = opening?.phase === 'dealing';
  const myKitty = opening?.phase === 'kitty' && opening.standing.declarer === 0;
  const playing = hand?.phase === 'playing';

  // Picks belong to one step: dealing, kitty and play must each start with nothing selected.
  const stage = opening?.phase ?? hand?.phase;
  useEffect(() => setSelected(new Set()), [stage]);
  const myTurn = !!playing && hand!.turn === 0;

  const begin = (next: Standing) => {
    if (!wager(bet)) return;
    settled.current = false;
    setStaked(bet);
    setStanding(next);
    setHand(null);
    setOpening(startOpening(shuffle(makeDeck()), next));
    setSelected(new Set());
    setError('');
    lock();
  };

  const deal = () => begin({ levels: [2, 2], declarer: Math.floor(Math.random() * 4) });

  const continueGame = () => {
    if (!standing || !hand?.result) return;
    const next = nextHand(standing, hand.result.outcome);
    if (next.gameWonBy !== null) {
      setGameWonBy(next.gameWonBy);
      return;
    }
    begin({ levels: next.levels, declarer: next.declarer });
  };

  const newGame = () => {
    setGameWonBy(null);
    setStanding(null);
    setHand(null);
    setOpening(null);
  };

  // The cards are dealt one at a time, and the bots declare as they like.
  useEffect(() => {
    if (opening?.phase !== 'dealing') return;
    const timer = window.setTimeout(() => setOpening((o) => (o ? dealOne(o) : o)), DEAL_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);

  // A bot declarer buries the kitty a moment after the deal.
  useEffect(() => {
    if (opening?.phase !== 'kitty' || opening.standing.declarer === 0) return;
    const timer = window.setTimeout(() => {
      setHand(botBury(opening));
      setOpening(null);
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [opening]);

  // The bots play a moment after each other.
  useEffect(() => {
    if (!hand || hand.phase !== 'playing' || hand.turn === 0) return;
    const timer = window.setTimeout(() => {
      setHand((h) => {
        if (!h || h.phase !== 'playing' || h.turn === 0) return h;
        const out = playCards(h, h.turn, botCards(h));
        return out.ok ? out.state : h;
      });
    }, BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hand]);

  // Pay out once, when the hand ends.
  useEffect(() => {
    if (!hand || hand.phase !== 'over' || !hand.result || settled.current) return;
    settled.current = true;
    settle(staked * payoutFor(hand.result));
  }, [hand, staked, settle]);

  const canPick = myTurn || dealing || myKitty;
  const toggle = (card: SCard) => {
    if (!canPick) return;
    setError('');
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
  };

  const playSelected = () => {
    if (!hand || !myTurn) return;
    const cards = hand.hands[0].filter((c) => selected.has(c.id));
    const out = playCards(hand, 0, cards);
    if (!out.ok) {
      fail(out.error);
      return;
    }
    setError('');
    setSelected(new Set());
    setHand(out.state);
  };

  const declareSelected = () => {
    if (!opening) return;
    const out = declare(opening, 0, opening.hands[0].filter((c) => selected.has(c.id)));
    if (!out.ok) {
      fail(out.error);
      return;
    }
    setError('');
    setSelected(new Set());
    setOpening(out.opening);
  };

  const buryChosen = () => {
    if (!opening) return;
    const out = buryKitty(opening, declarerCards(opening).filter((c) => selected.has(c.id)));
    if (!out.ok) {
      fail(out.error);
      return;
    }
    setError('');
    setSelected(new Set());
    setHand(out.state);
    setOpening(null);
  };

  /** While dealing, the trump is only what has been declared so far, and the level cards still count as trump. */
  const viewTrump: Trump | null = hand?.trump ?? opening?.trump ?? (opening ? { level: opening.level, suit: opening.declared?.declaration.suit ?? null } : null);
  const myCards = hand ? hand.hands[0] : opening ? (myKitty ? declarerCards(opening) : opening.hands[0]) : [];
  const mine = viewTrump ? sortHand(myCards, viewTrump) : [];
  const groups = viewTrump ? [...new Set(mine.map((c) => domainOf(c, viewTrump)))].map((d) => ({ domain: d, cards: mine.filter((c) => domainOf(c, viewTrump) === d) })) : [];
  const shownTrick = hand && hand.trick.length > 0 ? hand.trick : hand?.lastTrick?.plays ?? [];
  const showingLast = !!hand && hand.trick.length === 0 && !!hand.lastTrick;
  const result = hand?.result;
  const attackers = hand ? attackingTeam(hand) : 0;
  const iAmAttacking = attackers === teamOf(0);

  return (
    <section className="table shengji">
      <h2>{t('game.shengji.name')}</h2>

      {opening && standing && (
        <>
          <p className="scoreboard">
            {tx('shengji.levels', { mine: <b>{levelLabel(standing.levels[0])}</b>, theirs: <b>{levelLabel(standing.levels[1])}</b> })} · {t(`shengji.declarer.${standing.declarer}` as 'shengji.declarer.0')}
          </p>
          <p className="hint sj-declaration">
            {dealing
              ? opening.declared
                ? t('shengji.dealing.declared', { level: levelLabel(opening.level), suit: opening.declared.declaration.suit === null ? t('shengji.noTrump') : SUIT_SYMBOL[opening.declared.declaration.suit] })
                : t('shengji.dealing.none', { level: levelLabel(opening.level) })
              : opening.trump
                ? trumpText(opening.trump)
                : ''}
          </p>
          <div className="sj-table">
            {([2, 1, 3] as const).map((seat) => (
              <div key={seat} className={`sj-seat ${PLACE[seat]}`}>
                <b>{seatName(seat)}</b>
                <small>{t('shengji.cards', { count: opening.hands[seat].length + (opening.phase === 'kitty' && seat === standing.declarer ? KITTY_SIZE : 0) })}</small>
              </div>
            ))}
          </div>
          <p className="hand-label">{t('shengji.handLabel', { count: myCards.length })}</p>
          <div className="sj-hand">
            {groups.map((g) => (
              <div key={g.domain} className="sj-group" role="group" aria-label={domainName(g.domain)}>
                {g.cards.map((c) => (
                  <ShengjiCardView key={c.id} card={c} selected={selected.has(c.id)} onClick={canPick ? () => toggle(c) : undefined} />
                ))}
              </div>
            ))}
          </div>
          <p className="result" aria-live="polite">
            {opening.log && <>{translateEngine(opening.log, t)} </>}
            {myKitty && <>{t('shengji.pickup', { count: KITTY_SIZE })}</>}
            {opening.phase === 'kitty' && !myKitty && <>{t(`shengji.choosing.${standing.declarer}` as 'shengji.choosing.1')}</>}
          </p>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
        </>
      )}

      {hand && standing ? (
        <>
          <p className="scoreboard">
            {tx('shengji.levels', { mine: <b>{levelLabel(standing.levels[0])}</b>, theirs: <b>{levelLabel(standing.levels[1])}</b> })} · {trumpText(hand.trump)} ·{' '}
            {t(`shengji.declarer.${hand.declarer}` as 'shengji.declarer.0')}
          </p>
          <p className="hint sj-points">
            {t(iAmAttacking ? 'shengji.attacking' : 'shengji.defending')}{' '}
            {tx('shengji.points', { points: <b>{hand.attackerPoints}</b>, target: ATTACK_TARGET, tricks: hand.tricksPlayed })}
          </p>

          <div className="sj-table">
            {([2, 1, 3] as const).map((seat) => (
              <div key={seat} className={`sj-seat ${PLACE[seat]}${hand.turn === seat && playing ? ' turn' : ''}`}>
                <b>{seatName(seat)}</b>
                <small>{t('shengji.cards', { count: hand.hands[seat].length })}</small>
              </div>
            ))}
            <div className="sj-center" aria-label={t(showingLast ? 'shengji.lastTrick' : 'shengji.currentTrick')}>
              {PLACE.map((place, seat) => {
                const cards = shownTrick.find((p) => p.seat === seat)?.cards ?? [];
                return (
                  <div key={place} className={`sj-play ${place}`}>
                    {cards.map((c) => (
                      <ShengjiCardView key={c.id} card={c} faded={showingLast} />
                    ))}
                  </div>
                );
              })}
            </div>
            {showingLast && hand.lastTrick && (
              <p className="hint sj-last">
                {t('shengji.lastTrickWon', { who: t(`shengji.who.${hand.lastTrick.winner}` as 'shengji.who.0'), points: totalPoints(hand.lastTrick.plays.flatMap((p) => p.cards)) })}
              </p>
            )}
          </div>

          <p className="hand-label">
            {t('shengji.handLabel', { count: hand.hands[0].length })}
            {myTurn ? t('shengji.handTurn') : playing ? t('shengji.handWait') : ''}
          </p>
          <div className="sj-hand">
            {groups.map((g) => (
              <div key={g.domain} className="sj-group" role="group" aria-label={domainName(g.domain)}>
                {g.cards.map((c) => (
                  <ShengjiCardView key={c.id} card={c} selected={selected.has(c.id)} onClick={myTurn ? () => toggle(c) : undefined} />
                ))}
              </div>
            ))}
          </div>

          <p className="result" aria-live="polite">
            {hand.log && <>{translateEngine(hand.log, t)} </>}
            {playing && !myTurn && <>{t(`shengji.waiting.${hand.turn}` as 'shengji.waiting.1')}</>}
            {myTurn && hand.trick.length === 0 && <>{t('shengji.yourLead')}</>}
            {myTurn && hand.trick.length > 0 && <>{hand.trick[0].cards.length === 1 ? t('shengji.followOne') : t('shengji.followMany', { count: hand.trick[0].cards.length })}</>}
            {result && (
              <>
                {result.kittyBonus > 0 ? t('shengji.scoredKitty', { score: result.attackerScore, kitty: result.kittyBonus }) : t('shengji.scored', { score: result.attackerScore })}{' '}
                {t(resultKey(result.winningTeam === teamOf(0), result.outcome.levels), { levels: result.outcome.levels })}{' '}
                {payoutFor(result) > 0 ? (
                  <span className="gain">{t('game.gain', { amount: staked * payoutFor(result) - staked })}</span>
                ) : (
                  <span className="loss">{t('game.loss', { amount: staked })}</span>
                )}
              </>
            )}
          </p>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          {gameWonBy !== null && (
            <p className="result">
              <b>{t(gameWonBy === teamOf(0) ? 'shengji.gameWon.you' : 'shengji.gameWon.other')}</b>
            </p>
          )}
        </>
      ) : (
        !opening && (
          <div className="cards">
            <div className="slot" />
          </div>
        )
      )}

      <div className="actions">
        {dealing && (
          <>
            <button className="primary" onClick={declareSelected} disabled={selected.size === 0}>
              {t('shengji.declare')}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              {t('shengji.clear')}
            </button>
          </>
        )}
        {myKitty && (
          <>
            <button className="primary" onClick={buryChosen} disabled={selected.size !== KITTY_SIZE}>
              {selected.size === KITTY_SIZE ? t('shengji.putBack', { count: KITTY_SIZE }) : t('shengji.putBackChoose', { count: KITTY_SIZE, chosen: selected.size })}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              {t('shengji.clear')}
            </button>
          </>
        )}
        {myTurn && (
          <>
            <button className="primary" onClick={playSelected} disabled={selected.size === 0}>
              {selected.size > 0 ? t(selected.size === 1 ? 'shengji.play.one' : 'shengji.play.many', { count: selected.size }) : t('shengji.play.choose')}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              {t('shengji.clear')}
            </button>
          </>
        )}
        {hand?.phase === 'over' && gameWonBy === null && (
          <button className="primary" onClick={continueGame} disabled={locked || balance < bet}>
            {t('shengji.nextHand')}
          </button>
        )}
        {((!hand && !opening) || gameWonBy !== null) && (
          <button className="primary" onClick={gameWonBy !== null ? newGame : deal} disabled={gameWonBy === null && balance < bet}>
            {t(gameWonBy !== null ? 'shengji.newGame' : 'shengji.deal')}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing || !!opening} />
    </section>
  );
}
