import { useState, type MouseEvent } from 'react';
import { useWallet } from '../wallet';
import { CardView } from '../components/CardView';
import { BetPanel } from '../components/BetPanel';
import {
  drawFromStock,
  moveCards,
  movingCards,
  newKlondike,
  outcome,
  sameSource,
  type KState,
  type Source,
  type Target,
} from './klondikeRules';

type Status = 'betting' | 'playing' | 'won' | 'lost';

export function Klondike() {
  const { balance, wager, settle } = useWallet();
  const [bet, setBet] = useState(25);
  const [activeBet, setActiveBet] = useState(0);
  const [state, setState] = useState<KState | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);
  const [status, setStatus] = useState<Status>('betting');

  const playing = status === 'playing';

  const deal = () => {
    if (!wager(bet)) return;
    setState(newKlondike());
    setSelected(null);
    setActiveBet(bet);
    setStatus('playing');
  };

  const commit = (next: KState) => {
    setState(next);
    setSelected(null);
    const result = outcome(next);
    if (result !== 'playing') {
      setStatus(result);
      if (result === 'won') settle(activeBet * 2);
    }
  };

  const attempt = (src: Source, target: Target): boolean => {
    if (!state) return false;
    const next = moveCards(state, src, target);
    if (!next) return false;
    commit(next);
    return true;
  };

  /** Click a card: select it, or, if something is already selected, move the selection onto it. */
  const clickSource = (src: Source, target: Target | null) => {
    if (!state || !playing) return;
    if (selected) {
      if (sameSource(selected, src)) {
        setSelected(null);
        return;
      }
      if (target && attempt(selected, target)) return;
    }
    setSelected(movingCards(state, src) ? src : null);
  };

  /** Click an empty pile or column to move the current selection there. */
  const clickTarget = (target: Target) => {
    if (!state || !playing || !selected) return;
    attempt(selected, target);
  };

  const draw = () => {
    if (!state || !playing) return;
    commit(drawFromStock(state));
  };

  const forfeit = () => {
    setStatus('lost');
    setSelected(null);
  };

  const isSelected = (src: Source) => selected !== null && sameSource(selected, src);
  // Stop clicks on a card from also firing the pile/column handler behind it.
  const stop = (fn: () => void) => (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    fn();
  };

  return (
    <section className="table klondike">
      <h2>Klondike Solitaire</h2>

      {state && (
        <>
          <div className="top">
            <div className="group">
              {state.stock.length > 0 ? (
                <CardView faceDown onClick={stop(draw)} />
              ) : (
                <button className="slot" onClick={draw} disabled={!playing || state.recyclesLeft === 0 || state.waste.length === 0} aria-label="Recycle waste to stock">
                  ↻
                </button>
              )}
              {state.waste.length > 0 ? (
                <CardView
                  card={state.waste[state.waste.length - 1]}
                  selected={isSelected({ from: 'waste' })}
                  onClick={stop(() => clickSource({ from: 'waste' }, null))}
                />
              ) : (
                <div className="slot" />
              )}
            </div>

            <div className="group">
              {state.foundations.map((pile, p) => {
                const top = pile[pile.length - 1];
                const target: Target = { to: 'foundation', pile: p };
                return top ? (
                  <CardView
                    key={p}
                    card={top}
                    selected={isSelected({ from: 'foundation', pile: p })}
                    onClick={stop(() => clickSource({ from: 'foundation', pile: p }, target))}
                  />
                ) : (
                  <button key={p} className="slot" onClick={() => clickTarget(target)} aria-label={`Empty foundation ${p + 1}`}>
                    A
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tableau">
            {state.tableau.map((column, c) => (
              <div key={c} className="column" onClick={() => clickTarget({ to: 'tableau', col: c })}>
                {column.length === 0 ? (
                  <div className="slot" />
                ) : (
                  column.map((card, i) =>
                    card.up ? (
                      <CardView
                        key={i}
                        card={card}
                        selected={isSelected({ from: 'tableau', col: c, index: i })}
                        onClick={stop(() =>
                          clickSource({ from: 'tableau', col: c, index: i }, { to: 'tableau', col: c }),
                        )}
                      />
                    ) : (
                      <CardView key={i} faceDown />
                    ),
                  )
                )}
              </div>
            ))}
          </div>

          <p className="result">
            {status === 'playing' && (
              <>
                {state.stock.length} in stock · {state.recyclesLeft} stock recycles left
              </>
            )}
            {status === 'won' && (
              <>
                You won! <span className="gain">+{activeBet} coins</span>
              </>
            )}
            {status === 'lost' && (
              <>
                No more moves. <span className="loss">-{activeBet} coins</span>
              </>
            )}
          </p>
        </>
      )}

      <div className="actions">
        {playing ? (
          <button onClick={forfeit}>Give up (lose bet)</button>
        ) : (
          <button className="primary" onClick={deal} disabled={balance < bet}>
            {state ? 'Deal new game' : 'Deal'}
          </button>
        )}
      </div>

      <BetPanel value={bet} onChange={setBet} max={balance} disabled={playing} />

      <p className="hint">
        Click a card to select it, then click a destination. Win pays 2× your bet; giving up or running out of
        moves loses it. The stock can be recycled twice.
      </p>
    </section>
  );
}
