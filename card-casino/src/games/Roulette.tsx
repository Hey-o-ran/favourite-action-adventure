import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWallet } from '../wallet';
import {
  CHIPS,
  COLUMNS,
  HISTORY_SIZE,
  POCKETS,
  WHEEL_ORDER,
  boardNumber,
  colourOf,
  columnSpot,
  cornerSpot,
  dozenSpot,
  evenMoneySpot,
  placeChip,
  removeChip,
  returnedFor,
  sixLineSpot,
  spinWheel,
  splitSpot,
  spotId,
  straightSpot,
  streetSpot,
  totalStake,
  type Bet,
  type Spot,
} from './rouletteRules';

/** How long the wheel spins before the result shows. */
export const SPIN_MS = 3500;
const STEP = 360 / POCKETS;

const COLOUR_FILL = { red: '#c81e1e', black: '#111827', green: '#15803d' } as const;

const polar = (radius: number, degrees: number) => {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [100 + radius * Math.cos(a), 100 + radius * Math.sin(a)] as const;
};
const sectorPath = (i: number) => {
  const [x1, y1] = polar(96, (i - 0.5) * STEP);
  const [x2, y2] = polar(96, (i + 0.5) * STEP);
  const [x3, y3] = polar(66, (i + 0.5) * STEP);
  const [x4, y4] = polar(66, (i - 0.5) * STEP);
  return `M${x1} ${y1} A96 96 0 0 1 ${x2} ${y2} L${x3} ${y3} A66 66 0 0 0 ${x4} ${y4}Z`;
};

function Wheel({ rotation, spinning, result }: { rotation: number; spinning: boolean; result: number | null }) {
  return (
    <svg className="rl-wheel" viewBox="0 0 200 200" role="img" aria-label={result === null ? 'Roulette wheel' : `Roulette wheel: the ball is on ${result}`}>
      <g
        style={{
          transformOrigin: '100px 100px',
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.7, 0.2, 1)` : 'none',
        }}
      >
        <circle cx="100" cy="100" r="99" fill="#3a2412" />
        {WHEEL_ORDER.map((n, i) => (
          <g key={n}>
            <path d={sectorPath(i)} fill={COLOUR_FILL[colourOf(n)]} stroke="#e5c07b" strokeWidth="0.6" />
            <text
              x={polar(81, i * STEP)[0]}
              y={polar(81, i * STEP)[1]}
              fill="#fff"
              fontSize="7.5"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${i * STEP} ${polar(81, i * STEP)[0]} ${polar(81, i * STEP)[1]})`}
            >
              {n}
            </text>
          </g>
        ))}
        <circle cx="100" cy="100" r="62" fill="#0b5d3b" stroke="#e5c07b" strokeWidth="1" />
      </g>
      {/* The marker stays still at the top: whichever pocket is under it is the result. */}
      <path d="M100 8 L94 -2 L106 -2 Z" fill="#f5c542" stroke="#1a1300" strokeWidth="0.8" transform="translate(0 6)" />
      <text x="100" y="100" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="800" fill={result === null ? '#a7c4b5' : '#fff'}>
        {result === null ? (spinning ? '…' : '') : result}
      </text>
    </svg>
  );
}

const names = (numbers: number[]) => numbers.join(', ');
const splitLabel = (a: number, b: number) => `Split ${Math.min(a, b)} and ${Math.max(a, b)}`;

export function Roulette() {
  const { balance, wager, settle } = useWallet();
  const [chip, setChip] = useState<number>(10);
  const [bets, setBets] = useState<Bet[]>([]);
  /** Every chip put down, newest last, so Undo takes them back one at a time. */
  const [placed, setPlaced] = useState<{ spot: Spot; chip: number }[]>([]);
  const [lastBets, setLastBets] = useState<Bet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<{ staked: number; returned: number } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const stake = totalStake(bets);
  const available = balance - stake;
  const canBet = !spinning;

  const place = (spot: Spot | null) => {
    if (!spot || !canBet || chip > available) return;
    setBets((b) => placeChip(b, spot, chip));
    setPlaced((p) => [...p, { spot, chip }]);
  };

  const undo = () => {
    const last = placed[placed.length - 1];
    if (!last || spinning) return;
    setBets((b) => removeChip(b, last.spot, last.chip));
    setPlaced((p) => p.slice(0, -1));
  };

  const clear = () => {
    if (spinning) return;
    setBets([]);
    setPlaced([]);
  };

  const rebet = () => {
    if (spinning || totalStake(lastBets) > balance) return;
    setBets(lastBets);
    setPlaced(lastBets.map((b) => ({ spot: b, chip: b.amount })));
  };

  const spin = () => {
    if (spinning || stake < 1 || !wager(stake)) return;
    const landed = spinWheel();
    // Turn the wheel so the pocket that was chosen ends up under the marker at the top, after a few full turns.
    const target = -WHEEL_ORDER.indexOf(landed as (typeof WHEEL_ORDER)[number]) * STEP;
    setRotation((r) => r + 360 * 5 + ((((target - r) % 360) + 360) % 360));
    setSpinning(true);
    setResult(null);
    setOutcome(null);
    const spun = bets;
    timer.current = window.setTimeout(() => {
      const returned = returnedFor(spun, landed);
      setResult(landed);
      setHistory((h) => [landed, ...h].slice(0, HISTORY_SIZE));
      setOutcome({ staked: stake, returned });
      setLastBets(spun);
      setBets([]);
      setPlaced([]);
      setSpinning(false);
      // The wallet expects a settle for every wager, with 0 for a loss.
      settle(returned);
    }, SPIN_MS);
  };

  const amountAt = (spot: Spot) => bets.find((b) => spotId(b) === spotId(spot))?.amount ?? 0;

  /** A button on the table that puts chips on a spot. */
  const spotButton = (spot: Spot | null, label: string, className: string, children?: ReactNode) => {
    const amount = spot ? amountAt(spot) : 0;
    return (
      <button
        key={spot ? spotId(spot) : label}
        className={className}
        aria-label={amount > 0 ? `${label}, ${amount} coins on it` : label}
        disabled={!canBet || !spot}
        onClick={() => place(spot)}
      >
        {children}
        {amount > 0 && <span className="rl-chip">{amount}</span>}
      </button>
    );
  };

  const columns = Array.from({ length: COLUMNS }, (_, c) => c);

  return (
    <section className="table roulette">
      <h2>Roulette</h2>

      <div className="rl-top">
        <Wheel rotation={rotation} spinning={spinning} result={result} />
        <div className="rl-side">
          <p className="result" aria-live="polite">
            {spinning && <>No more bets! The ball is rolling…</>}
            {!spinning && result !== null && outcome && (
              <>
                The ball landed on{' '}
                <b className={`rl-num ${colourOf(result)}`}>
                  {result} {colourOf(result)}
                </b>
                .{' '}
                {outcome.returned > outcome.staked && (
                  <>
                    You win <span className="gain">+{outcome.returned - outcome.staked} coins</span>!
                  </>
                )}
                {outcome.returned === outcome.staked && <>You got your bet back.</>}
                {outcome.returned > 0 && outcome.returned < outcome.staked && (
                  <>
                    You got back {outcome.returned} of {outcome.staked}: <span className="loss">-{outcome.staked - outcome.returned} coins</span>.
                  </>
                )}
                {outcome.returned === 0 && (
                  <>
                    No luck: <span className="loss">-{outcome.staked} coins</span>.
                  </>
                )}
              </>
            )}
            {!spinning && result === null && <>Choose a chip, then tap the numbers and bets you want. Then spin!</>}
          </p>
          {history.length > 0 && (
            <ol className="rl-history" aria-label="Recent results">
              {history.map((n, i) => (
                <li key={i} className={`rl-num ${colourOf(n)}`}>
                  {n}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="rl-chips" role="group" aria-label="Chip value">
        {CHIPS.map((value) => (
          <button key={value} className={`rl-chip-pick${chip === value ? ' on' : ''}`} aria-pressed={chip === value} onClick={() => setChip(value)} disabled={spinning}>
            {value}
          </button>
        ))}
        <span className="rl-total" aria-live="polite">
          On the table: <b>{stake}</b> coins
        </span>
      </div>

      <div className="rl-scroll">
        <div className="rl-board" role="group" aria-label="Betting table">
          <div className="rl-zero" style={{ gridColumn: 1, gridRow: '1 / span 3' }}>
            {spotButton(straightSpot(0), 'Number 0, green', 'rl-n green', '0')}
          </div>

          {columns.map((c) =>
            [0, 1, 2].map((r) => {
              const n = boardNumber(c, r);
              const colour = colourOf(n);
              return (
                <div key={n} className="rl-cell" style={{ gridColumn: c + 2, gridRow: r + 1 }}>
                  {spotButton(straightSpot(n), `Number ${n}, ${colour}`, `rl-n ${colour}`, n)}
                  {/* The small buttons on the edges and corners of a number are the bets that cover its neighbours too. */}
                  {c === 0 && spotButton(splitSpot(0, n), splitLabel(0, n), 'rl-hs left')}
                  {c < COLUMNS - 1 && spotButton(splitSpot(n, boardNumber(c + 1, r)), splitLabel(n, boardNumber(c + 1, r)), 'rl-hs right')}
                  {r < 2 && spotButton(splitSpot(n, boardNumber(c, r + 1)), splitLabel(n, boardNumber(c, r + 1)), 'rl-hs down')}
                  {r < 2 && c < COLUMNS - 1 && spotButton(cornerSpot(c, r), `Corner ${names(cornerSpot(c, r).numbers)}`, 'rl-hs corner')}
                  {r === 2 && spotButton(streetSpot(c), `Street ${names(streetSpot(c).numbers)}`, 'rl-hs down')}
                  {r === 2 && c < COLUMNS - 1 && spotButton(sixLineSpot(c), `Six line ${sixLineSpot(c).numbers[0]} to ${sixLineSpot(c).numbers[5]}`, 'rl-hs corner')}
                </div>
              );
            }),
          )}

          {([2, 1, 0] as const).map((index, r) => (
            <div key={index} style={{ gridColumn: COLUMNS + 2, gridRow: r + 1 }}>
              {spotButton(columnSpot(index), `Column ${index + 1}: ${names(columnSpot(index).numbers.slice(0, 3))} and so on, pays 2 to 1`, "rl-out", "2:1")}
            </div>
          ))}

          {([0, 1, 2] as const).map((index) => (
            <div key={index} style={{ gridColumn: `${index * 4 + 2} / span 4`, gridRow: 4 }}>
              {spotButton(dozenSpot(index), `Dozen ${index * 12 + 1} to ${index * 12 + 12}, pays 2 to 1`, "rl-out", `${index * 12 + 1}–${index * 12 + 12}`)}
            </div>
          ))}

          {(
            [
              ['low', '1–18'],
              ['even', 'Even'],
              ['red', 'Red'],
              ['black', 'Black'],
              ['odd', 'Odd'],
              ['high', '19–36'],
            ] as const
          ).map(([kind, text], i) => (
            <div key={kind} style={{ gridColumn: `${i * 2 + 2} / span 2`, gridRow: 5 }}>
              {spotButton(evenMoneySpot(kind), `${text}, pays 1 to 1`, `rl-out ${kind === 'red' || kind === 'black' ? kind : ''}`, text)}
            </div>
          ))}
        </div>
      </div>

      <div className="actions">
        <button className="primary" onClick={spin} disabled={spinning || stake < 1}>
          {spinning ? 'Spinning…' : stake > 0 ? `Spin · ${stake} coins` : 'Spin'}
        </button>
        <button onClick={undo} disabled={spinning || placed.length === 0}>
          Undo
        </button>
        <button onClick={clear} disabled={spinning || bets.length === 0}>
          Clear
        </button>
        <button onClick={rebet} disabled={spinning || bets.length > 0 || lastBets.length === 0 || totalStake(lastBets) > balance}>
          Rebet {lastBets.length > 0 ? `(${totalStake(lastBets)})` : ''}
        </button>
      </div>
    </section>
  );
}
