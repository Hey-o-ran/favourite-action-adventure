import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../wallet';
import { SUITS, SUIT_SYMBOL, isRed, newDeck, shuffle, type Suit } from '../cards';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import {
  botTurn,
  drawForPlayer,
  isPlayable,
  playCard,
  returnedFor,
  startCrazyEights,
  topCard,
  type CrazyEightsState,
} from './crazyEightsRules';

/** How long the bot "thinks", so you can follow what it did. */
const BOT_DELAY_MS = 800;

export function CrazyEights() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(10);
  const [game, setGame] = useState<CrazyEightsState | null>(null);
  /** The index of an 8 waiting for the player to choose its suit. */
  const [pickingFor, setPickingFor] = useState<number | null>(null);
  const settled = useRef(true);

  const playing = game?.status === 'playing';
  const myTurn = playing && game.turn === 'player';
  const mustDraw = myTurn && !game.player.some((c) => isPlayable(c, game));

  const deal = () => {
    if (!wager(bet)) return;
    settled.current = false;
    setPickingFor(null);
    // Fresh shuffle every round.
    setGame(startCrazyEights(shuffle(newDeck()), bet));
  };

  // The bot moves a moment after the player.
  useEffect(() => {
    if (!game || game.status !== 'playing' || game.turn !== 'bot') return;
    const timer = window.setTimeout(() => setGame((g) => (g ? botTurn(g) : g)), BOT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game]);

  // Pay out once, when the round ends.
  useEffect(() => {
    if (!game || game.status === 'playing' || settled.current) return;
    settled.current = true;
    settle(returnedFor(game));
  }, [game, settle]);

  const clickCard = (index: number) => {
    if (!game || !myTurn || !isPlayable(game.player[index], game)) return;
    if (game.player[index].rank === 8) {
      setPickingFor(index);
      return;
    }
    setGame(playCard(game, index));
  };

  const chooseSuit = (suit: Suit) => {
    if (!game || pickingFor === null) return;
    setGame(playCard(game, pickingFor, suit));
    setPickingFor(null);
  };

  const draw = () => game && setGame(drawForPlayer(game));

  return (
    <section className="table">
      <h2>Crazy Eights</h2>

      {game ? (
        <>
          <p className="hand-label">Bot · {game.bot.length} cards</p>
          <div className="cards">
            {game.bot.map((_, i) => (
              <CardView key={i} faceDown />
            ))}
          </div>

          <div className="pile-row">
            <div className="pile">
              <CardView faceDown />
              <small>{game.stock.length} left</small>
            </div>
            <div className="pile">
              <CardView card={topCard(game)} />
              <small className={isRed({ rank: 1, suit: game.suit }) ? 'suit red' : 'suit'}>Suit: {SUIT_SYMBOL[game.suit]}</small>
            </div>
          </div>

          <p className="hand-label">You · {game.player.length} cards</p>
          <div className="cards">
            {game.player.map((card, i) => {
              const ok = myTurn && isPlayable(card, game);
              return (
                <div key={`${card.rank}-${card.suit}`} className={ok ? undefined : 'dim'}>
                  <CardView card={card} selected={pickingFor === i} onClick={ok ? () => clickCard(i) : undefined} />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="cards">
          <div className="slot" />
        </div>
      )}

      <p className="result">
        {game && <>{game.log} </>}
        {game?.status === 'won' && (
          <>
            You win! <span className="gain">+{returnedFor(game) - game.bet} coins</span>
          </>
        )}
        {game?.status === 'lost' && (
          <>
            Bot goes out. <span className="loss">-{game.bet} coins</span>
          </>
        )}
        {game?.status === 'draw' && <>Nobody can move. Bet returned.</>}
        {playing && game.turn === 'bot' && <>Bot is thinking…</>}
      </p>

      {pickingFor !== null && (
        <div className="actions" role="group" aria-label="Choose a suit for your 8">
          {SUITS.map((suit) => (
            <button key={suit} className="primary" onClick={() => chooseSuit(suit)}>
              {SUIT_SYMBOL[suit]}
            </button>
          ))}
          <button onClick={() => setPickingFor(null)}>Cancel</button>
        </div>
      )}

      <div className="actions">
        {playing ? (
          <button onClick={draw} disabled={!mustDraw}>
            {mustDraw ? 'Draw cards' : 'Play a card (or draw if you can’t)'}
          </button>
        ) : (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {game ? 'Deal again' : 'Deal'}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />
    </section>
  );
}
