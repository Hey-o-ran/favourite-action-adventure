import { drawCard, type Card } from '../cards';

export interface HandRank {
  name: string;
  /** Payout per coin wagered, including the stake (0 = loss). */
  multiplier: number;
}

export const PAYTABLE: HandRank[] = [
  { name: 'Royal Flush', multiplier: 800 },
  { name: 'Straight Flush', multiplier: 50 },
  { name: 'Four of a Kind', multiplier: 25 },
  { name: 'Full House', multiplier: 9 },
  { name: 'Flush', multiplier: 6 },
  { name: 'Straight', multiplier: 4 },
  { name: 'Three of a Kind', multiplier: 3 },
  { name: 'Two Pair', multiplier: 2 },
  { name: 'Jacks or Better', multiplier: 1 },
];

const find = (name: string) => PAYTABLE.find((r) => r.name === name)!;

export function evaluateHand(cards: readonly Card[]): HandRank {
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  // Groups sorted by how many cards share a rank, then by rank (high first).
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const top = groups[0][1];
  const second = groups[1]?.[1] ?? 0;

  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const royal = ranks.join(',') === '1,10,11,12,13';
  const straight = ranks.length === 5 && (royal || ranks[4] - ranks[0] === 4);

  if (flush && royal) return find('Royal Flush');
  if (flush && straight) return find('Straight Flush');
  if (top === 4) return find('Four of a Kind');
  if (top === 3 && second === 2) return find('Full House');
  if (flush) return find('Flush');
  if (straight) return find('Straight');
  if (top === 3) return find('Three of a Kind');
  if (top === 2 && second === 2) return find('Two Pair');
  if (top === 2 && (groups[0][0] === 1 || groups[0][0] >= 11)) return find('Jacks or Better');
  return { name: 'No win', multiplier: 0 };
}

export interface VideoPokerRound {
  deck: Card[];
  hand: Card[];
  held: boolean[];
  drawn: boolean;
  bet: number;
}

export function dealVideoPoker(deck: readonly Card[], bet: number): VideoPokerRound {
  let rest = [...deck];
  const hand: Card[] = [];
  for (let i = 0; i < 5; i++) {
    const [card, remaining] = drawCard(rest);
    hand.push(card);
    rest = remaining;
  }
  return { deck: rest, hand, held: [false, false, false, false, false], drawn: false, bet };
}

export function toggleHold(r: VideoPokerRound, index: number): VideoPokerRound {
  if (r.drawn) return r;
  return { ...r, held: r.held.map((h, i) => (i === index ? !h : h)) };
}

export function drawReplacements(r: VideoPokerRound): VideoPokerRound {
  let deck = r.deck;
  const hand = r.hand.map((card, i) => {
    if (r.held[i]) return card;
    const [next, rest] = drawCard(deck);
    deck = rest;
    return next;
  });
  return { ...r, deck, hand, drawn: true };
}
