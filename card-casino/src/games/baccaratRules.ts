import { drawCard, newDeck, shuffle, type Card } from '../cards';

export type BaccaratSide = 'player' | 'banker' | 'tie';

/** Profit per coin staked when the bet wins. Banker pays 0.95 (a 5% commission), written as 95/100 to stay exact. */
export const PLAYER_PAYOUT = 1;
export const BANKER_PAYOUT_PERCENT = 95;
export const TIE_PAYOUT = 8;

const DECKS_IN_SHOE = 8;

/** A freshly shuffled 8-deck shoe. A new one is used every round. */
export function newShoe(): Card[] {
  return shuffle(Array.from({ length: DECKS_IN_SHOE }, newDeck).flat());
}

/** Aces are 1, 2 to 9 are face value, and 10, J, Q and K are worth nothing. */
export const baccaratValue = (card: Card) => (card.rank >= 10 ? 0 : card.rank);

/** Only the last digit of the sum counts, so the best possible hand is 9. */
export const handTotal = (cards: readonly Card[]) => cards.reduce((sum, c) => sum + baccaratValue(c), 0) % 10;

/** The player draws on 0 to 5 and stands on 6 or 7. A natural (8 or 9) ends the round before this is asked. */
export const playerDraws = (total: number) => total <= 5;

/**
 * The banker's third-card rule. `playerThird` is the value of the player's third card,
 * or null if the player stood on two cards.
 */
export function bankerDraws(bankerTotal: number, playerThird: number | null): boolean {
  if (playerThird === null) return bankerTotal <= 5;
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return playerThird !== 8;
    case 4:
      return playerThird >= 2 && playerThird <= 7;
    case 5:
      return playerThird >= 4 && playerThird <= 7;
    case 6:
      return playerThird === 6 || playerThird === 7;
    default:
      return false;
  }
}

export interface BaccaratRound {
  player: Card[];
  banker: Card[];
  winner: BaccaratSide;
  /** Either side was dealt 8 or 9 on the first two cards, so nobody drew. */
  natural: boolean;
  side: BaccaratSide;
  bet: number;
  /** Coins handed back, including the stake. A tie returns the stake on Player and Banker bets. */
  returned: number;
}

/** Banker wins pay 0.95 to 1, rounded down to a whole coin. */
const bankerReturn = (bet: number) => Math.floor((bet * (100 + BANKER_PAYOUT_PERCENT)) / 100);

export function playBaccarat(shoe: readonly Card[], side: BaccaratSide, bet: number): BaccaratRound {
  let rest = [...shoe];
  const take = () => {
    const [card, remaining] = drawCard(rest);
    rest = remaining;
    return card;
  };

  // Cards go out alternately: player, banker, player, banker.
  const player = [take()];
  const banker = [take()];
  player.push(take());
  banker.push(take());

  const natural = handTotal(player) >= 8 || handTotal(banker) >= 8;
  if (!natural) {
    let playerThird: number | null = null;
    if (playerDraws(handTotal(player))) {
      const card = take();
      player.push(card);
      playerThird = baccaratValue(card);
    }
    if (bankerDraws(handTotal(banker), playerThird)) banker.push(take());
  }

  const p = handTotal(player);
  const b = handTotal(banker);
  const winner: BaccaratSide = p > b ? 'player' : b > p ? 'banker' : 'tie';

  let returned = 0;
  if (winner === 'tie') returned = side === 'tie' ? bet * (1 + TIE_PAYOUT) : bet;
  else if (side === winner) returned = side === 'player' ? bet * (1 + PLAYER_PAYOUT) : bankerReturn(bet);

  return { player, banker, winner, natural, side, bet, returned };
}
