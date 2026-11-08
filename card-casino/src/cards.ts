export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

/** Rank 1 is an Ace (high or low depending on the game), 11 Jack, 12 Queen, 13 King. */
export interface Card {
  rank: number;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const rankLabel = (rank: number) => RANK_LABELS[rank];
export const isRed = (card: Card) => card.suit === 'hearts' || card.suit === 'diamonds';

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }
  return deck;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Takes the top card (index 0) off the deck. A fresh shuffled deck is used when this one is empty. */
export function drawCard(deck: readonly Card[]): [Card, Card[]] {
  const source = deck.length > 0 ? deck : shuffle(newDeck());
  return [source[0], source.slice(1)];
}
