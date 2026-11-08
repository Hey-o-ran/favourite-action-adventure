import { drawCard, type Card } from '../cards';

export interface HandValue {
  total: number;
  soft: boolean;
}

export function handValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === 1) {
      aces++;
      total += 11;
    } else {
      total += Math.min(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: readonly Card[]) =>
  cards.length === 2 && handValue(cards).total === 21;

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface Round {
  deck: Card[];
  player: Card[];
  dealer: Card[];
  /** The base wager. */
  bet: number;
  doubled: boolean;
  over: boolean;
  /** Coins to credit back once the round is over (0 for a loss, includes the stake on a win or push). */
  returned: number;
  outcome?: Outcome;
}

/** Total amount staked this round, including the double-down. */
export const stakeOf = (r: Round) => r.bet * (r.doubled ? 2 : 1);

export function dealRound(deck: readonly Card[], bet: number): Round {
  let rest: Card[] = [...deck];
  const next = (): Card => {
    const [card, remaining] = drawCard(rest);
    rest = remaining;
    return card;
  };
  const player = [next(), next()];
  const dealer = [next(), next()];
  const round: Round = { deck: rest, player, dealer, bet, doubled: false, over: false, returned: 0 };
  return isBlackjack(player) || isBlackjack(dealer) ? finish(round) : round;
}

export function hit(r: Round): Round {
  const [card, deck] = drawCard(r.deck);
  const next: Round = { ...r, deck, player: [...r.player, card] };
  const { total } = handValue(next.player);
  if (total > 21) return finish(next);
  return total === 21 ? stand(next) : next;
}

export function stand(r: Round): Round {
  if (handValue(r.player).total > 21) return finish(r);
  let deck = r.deck;
  const dealer = [...r.dealer];
  // The dealer draws to 17 and stands on all 17s.
  while (handValue(dealer).total < 17) {
    const [card, rest] = drawCard(deck);
    dealer.push(card);
    deck = rest;
  }
  return finish({ ...r, deck, dealer });
}

/** Takes one more card, doubles the stake, and then stands. Caller must have wagered the extra bet. */
export function doubleDown(r: Round): Round {
  const [card, deck] = drawCard(r.deck);
  return stand({ ...r, deck, player: [...r.player, card], doubled: true });
}

function finish(r: Round): Round {
  const stake = stakeOf(r);
  const p = handValue(r.player).total;
  const d = handValue(r.dealer).total;
  const playerBJ = isBlackjack(r.player);
  const dealerBJ = isBlackjack(r.dealer);

  let outcome: Outcome;
  let returned: number;
  if (p > 21) {
    outcome = 'bust';
    returned = 0;
  } else if (playerBJ && dealerBJ) {
    outcome = 'push';
    returned = stake;
  } else if (playerBJ) {
    outcome = 'blackjack';
    returned = Math.floor(stake * 2.5); // 3:2 pays 1.5x the stake plus the stake back
  } else if (dealerBJ) {
    outcome = 'lose';
    returned = 0;
  } else if (d > 21 || p > d) {
    outcome = 'win';
    returned = stake * 2;
  } else if (p === d) {
    outcome = 'push';
    returned = stake;
  } else {
    outcome = 'lose';
    returned = 0;
  }
  return { ...r, over: true, outcome, returned };
}
