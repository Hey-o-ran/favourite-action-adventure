import { isRed, newDeck, shuffle, type Card } from '../cards';

export interface KCard extends Card {
  up: boolean;
}

export interface KState {
  /** Top card is the last element. */
  stock: Card[];
  /** Top card is the last element. */
  waste: Card[];
  /** Ace up to King, one pile per suit. Top card is the last element. */
  foundations: Card[][];
  /** Seven columns. Top card is the last element. */
  tableau: KCard[][];
  recyclesLeft: number;
}

export type Source =
  | { from: 'waste' }
  | { from: 'foundation'; pile: number }
  | { from: 'tableau'; col: number; index: number };

export type Target = { to: 'foundation'; pile: number } | { to: 'tableau'; col: number };

export const COLUMN_COUNT = 7;
export const FOUNDATION_COUNT = 4;
/** Draw-one with three passes through the stock. */
export const MAX_RECYCLES = 2;

export function newKlondike(deck: readonly Card[] = shuffle(newDeck())): KState {
  const tableau: KCard[][] = [];
  let i = 0;
  for (let col = 0; col < COLUMN_COUNT; col++) {
    const pile: KCard[] = [];
    // Column `col` gets col + 1 cards; only the top one is face up.
    for (let k = 0; k <= col; k++) {
      const { rank, suit } = deck[i++];
      pile.push({ rank, suit, up: k === col });
    }
    tableau.push(pile);
  }
  return {
    stock: deck.slice(i), // 28 cards dealt to the tableau, 24 left in stock
    waste: [],
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    tableau,
    recyclesLeft: MAX_RECYCLES,
  };
}

export function drawFromStock(s: KState): KState {
  if (s.stock.length > 0) {
    const card = s.stock[s.stock.length - 1];
    return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, card] };
  }
  if (s.waste.length > 0 && s.recyclesLeft > 0) {
    return { ...s, stock: [...s.waste].reverse(), waste: [], recyclesLeft: s.recyclesLeft - 1 };
  }
  return s;
}

/** Whether `below` can sit directly under `above` in a tableau column. */
const continues = (above: Card, below: Card) => below.rank === above.rank - 1 && isRed(above) !== isRed(below);

/** The cards a source would move, or null if that source cannot be moved. */
export function movingCards(s: KState, src: Source): Card[] | null {
  if (src.from === 'waste') {
    const top = s.waste[s.waste.length - 1];
    return top ? [top] : null;
  }
  if (src.from === 'foundation') {
    const pile = s.foundations[src.pile];
    return pile.length ? [pile[pile.length - 1]] : null;
  }
  const run = s.tableau[src.col].slice(src.index);
  if (run.length === 0 || run.some((c) => !c.up)) return null;
  for (let k = 1; k < run.length; k++) {
    if (!continues(run[k - 1], run[k])) return null;
  }
  return run;
}

export function canPlace(cards: readonly Card[], target: Target, s: KState): boolean {
  const first = cards[0];
  if (target.to === 'foundation') {
    if (cards.length !== 1) return false;
    const pile = s.foundations[target.pile];
    const top = pile[pile.length - 1];
    return top ? top.suit === first.suit && first.rank === top.rank + 1 : first.rank === 1;
  }
  const column = s.tableau[target.col];
  const top = column[column.length - 1];
  return top ? top.up && continues(top, first) : first.rank === 13;
}

export function moveCards(s: KState, src: Source, target: Target): KState | null {
  if (src.from === 'tableau' && target.to === 'tableau' && target.col === src.col) return null;
  const cards = movingCards(s, src);
  if (!cards || !canPlace(cards, target, s)) return null;

  const next: KState = {
    ...s,
    foundations: s.foundations.map((p) => [...p]),
    tableau: s.tableau.map((c) => [...c]),
  };

  if (src.from === 'waste') {
    next.waste = s.waste.slice(0, -1);
  } else if (src.from === 'foundation') {
    next.foundations[src.pile] = s.foundations[src.pile].slice(0, -1);
  } else {
    const column = next.tableau[src.col].slice(0, src.index);
    const top = column[column.length - 1];
    if (top && !top.up) column[column.length - 1] = { ...top, up: true };
    next.tableau[src.col] = column;
  }

  if (target.to === 'foundation') {
    next.foundations[target.pile] = [
      ...next.foundations[target.pile],
      ...cards.map(({ rank, suit }) => ({ rank, suit })),
    ];
  } else {
    next.tableau[target.col] = [
      ...next.tableau[target.col],
      ...cards.map(({ rank, suit }) => ({ rank, suit, up: true })),
    ];
  }
  return next;
}

export function allTargets(): Target[] {
  const targets: Target[] = [];
  for (let col = 0; col < COLUMN_COUNT; col++) targets.push({ to: 'tableau', col });
  for (let pile = 0; pile < FOUNDATION_COUNT; pile++) targets.push({ to: 'foundation', pile });
  return targets;
}

export function hasAnyMove(s: KState): boolean {
  const sources: Source[] = [];
  if (s.waste.length) sources.push({ from: 'waste' });
  s.foundations.forEach((pile, p) => {
    if (pile.length) sources.push({ from: 'foundation', pile: p });
  });
  s.tableau.forEach((column, c) =>
    column.forEach((card, index) => {
      if (card.up) sources.push({ from: 'tableau', col: c, index });
    }),
  );
  return sources.some((src) => allTargets().some((t) => moveCards(s, src, t) !== null));
}

export function outcome(s: KState): 'won' | 'lost' | 'playing' {
  if (s.foundations.every((p) => p.length === 13)) return 'won';
  const outOfStock = s.stock.length === 0 && (s.waste.length === 0 || s.recyclesLeft === 0);
  return outOfStock && !hasAnyMove(s) ? 'lost' : 'playing';
}

export function sameSource(a: Source, b: Source): boolean {
  if (a.from !== b.from) return false;
  if (a.from === 'waste') return true;
  if (a.from === 'foundation') return a.pile === (b as { pile: number }).pile;
  const bt = b as { col: number; index: number };
  return a.col === bt.col && a.index === bt.index;
}
