import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { shuffle } from '../cards';
import { useDealLock } from '../useDealLock';
import { BetPanel } from '../components/BetPanel';
import { ShengjiCardView } from '../components/ShengjiCardView';
import { domainOf, makeDeck, sortHand, totalPoints, type Domain, type SCard } from './shengjiCards';
import { ATTACK_TARGET, levelLabel, nextHand, teamOf, type Standing } from './shengjiScoring';
import { attackingTeam, botCards, payoutFor, playCards, startHand, type HandState } from './shengjiTable';

/*
 * The Shengji (80 Points) table. Stage 2: you play a whole hand against bots that make legal plays but do not try to win
 * points yet. Declaring trump during the deal and choosing the kitty yourself come in the next stage, and the text will
 * be translated with the rest of the game then.
 */

/** How long a bot takes to play, so you can follow the trick. */
export const BOT_DELAY_MS = 700;

const SEAT_NAME = ['You', 'Left opponent', 'Partner', 'Right opponent'] as const;
const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;
const DOMAIN_NAME: Record<Domain, string> = { trump: 'Trumps', spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };

const sideName = (team: number) => (team === teamOf(0) ? 'Your side' : 'The other side');

/** Where a seat sits on the screen, from the player's point of view. */
const PLACE = ['bottom', 'left', 'top', 'right'] as const;

function trumpText(hand: HandState): string {
  const level = levelLabel(hand.trump.level);
  return hand.trump.suit === null ? `No trump suit, level ${level}` : `${SUIT_SYMBOL[hand.trump.suit]} is trump, level ${level}`;
}

export function Shengji() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(50);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [hand, setHand] = useState<HandState | null>(null);
  /** The coins staked on the hand being played. */
  const [staked, setStaked] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState('');
  /** Set when a side has won the whole game, by winning a hand as declarers at ace. */
  const [gameWonBy, setGameWonBy] = useState<0 | 1 | null>(null);
  const settled = useRef(true);
  const { locked, lock } = useDealLock();

  const playing = hand?.phase === 'playing';
  const myTurn = !!playing && hand!.turn === 0;

  const begin = (next: Standing) => {
    if (!wager(bet)) return;
    settled.current = false;
    setStaked(bet);
    setStanding(next);
    setHand(startHand(shuffle(makeDeck()), next));
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
  };

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

  const toggle = (card: SCard) => {
    if (!myTurn) return;
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
      setError(out.error);
      return;
    }
    setError('');
    setSelected(new Set());
    setHand(out.state);
  };

  const mine = hand ? sortHand(hand.hands[0], hand.trump) : [];
  const groups = hand ? [...new Set(mine.map((c) => domainOf(c, hand.trump)))].map((d) => ({ domain: d, cards: mine.filter((c) => domainOf(c, hand.trump) === d) })) : [];
  const shownTrick = hand && hand.trick.length > 0 ? hand.trick : hand?.lastTrick?.plays ?? [];
  const showingLast = !!hand && hand.trick.length === 0 && !!hand.lastTrick;
  const result = hand?.result;
  const attackers = hand ? attackingTeam(hand) : 0;
  const iAmAttacking = attackers === teamOf(0);

  return (
    <section className="table shengji">
      <h2>Shengji</h2>

      {hand && standing ? (
        <>
          <p className="scoreboard">
            Your side is on level <b>{levelLabel(standing.levels[0])}</b> · the other side on <b>{levelLabel(standing.levels[1])}</b> · {trumpText(hand)} ·{' '}
            {SEAT_NAME[hand.declarer] === 'You' ? 'You are' : `The ${SEAT_NAME[hand.declarer].toLowerCase()} is`} the declarer.
          </p>
          <p className="hint sj-points">
            {iAmAttacking ? 'You are attacking.' : 'You are defending.'} The attackers have <b>{hand.attackerPoints}</b> points and need {ATTACK_TARGET}. {hand.tricksPlayed} tricks played.
          </p>

          <div className="sj-table">
            {([2, 1, 3] as const).map((seat) => (
              <div key={seat} className={`sj-seat ${PLACE[seat]}${hand.turn === seat && playing ? ' turn' : ''}`}>
                <b>{SEAT_NAME[seat]}</b>
                <small>{hand.hands[seat].length} cards</small>
              </div>
            ))}
            <div className="sj-center" aria-label={showingLast ? 'The last trick' : 'The current trick'}>
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
                Last trick won by {SEAT_NAME[hand.lastTrick.winner].toLowerCase()} ({totalPoints(hand.lastTrick.plays.flatMap((p) => p.cards))} points).
              </p>
            )}
          </div>

          <p className="hand-label">
            Your hand · {hand.hands[0].length} cards{myTurn ? ' · your turn' : playing ? ' · waiting' : ''}
          </p>
          <div className="sj-hand">
            {groups.map((g) => (
              <div key={g.domain} className="sj-group" role="group" aria-label={DOMAIN_NAME[g.domain]}>
                {g.cards.map((c) => (
                  <ShengjiCardView key={c.id} card={c} selected={selected.has(c.id)} onClick={myTurn ? () => toggle(c) : undefined} />
                ))}
              </div>
            ))}
          </div>

          <p className="result" aria-live="polite">
            {hand.log && <>{hand.log} </>}
            {playing && !myTurn && <>Waiting for the {SEAT_NAME[hand.turn].toLowerCase()}…</>}
            {myTurn && hand.trick.length === 0 && <>Your lead: choose a card, a pair or a tractor.</>}
            {myTurn && hand.trick.length > 0 && <>Your turn: play {hand.trick[0].cards.length === 1 ? 'a card' : `${hand.trick[0].cards.length} cards`} to follow.</>}
            {result && (
              <>
                The attackers scored {result.attackerScore}
                {result.kittyBonus > 0 ? ` (${result.kittyBonus} from the kitty)` : ''}.{' '}
                {sideName(result.winningTeam)} {result.winningTeam === teamOf(0) ? 'win' : 'wins'}
                {result.outcome.levels > 0
                  ? ` and ${result.winningTeam === teamOf(0) ? 'move' : 'moves'} up ${result.outcome.levels} level${result.outcome.levels === 1 ? '' : 's'}`
                  : ' and take over the deal'}.{' '}
                {payoutFor(result) > 0 ? (
                  <span className="gain">+{staked * payoutFor(result) - staked} coins</span>
                ) : (
                  <span className="loss">-{staked} coins</span>
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
              <b>{sideName(gameWonBy)} won the whole game by winning a hand at ace!</b>
            </p>
          )}
        </>
      ) : (
        <div className="cards">
          <div className="slot" />
        </div>
      )}

      <div className="actions">
        {myTurn && (
          <>
            <button className="primary" onClick={playSelected} disabled={selected.size === 0}>
              {selected.size > 0 ? `Play ${selected.size} card${selected.size === 1 ? '' : 's'}` : 'Choose cards to play'}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
              Clear
            </button>
          </>
        )}
        {hand?.phase === 'over' && gameWonBy === null && (
          <button className="primary" onClick={continueGame} disabled={locked || balance < bet}>
            Next hand
          </button>
        )}
        {(!hand || gameWonBy !== null) && (
          <button className="primary" onClick={gameWonBy !== null ? newGame : deal} disabled={gameWonBy === null && balance < bet}>
            {gameWonBy !== null ? 'New game' : 'Deal'}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
    </section>
  );
}
