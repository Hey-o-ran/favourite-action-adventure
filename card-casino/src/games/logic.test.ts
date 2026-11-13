import { describe, expect, it } from 'vitest';
import type { Card } from '../cards';
import { handValue, dealRound, stand, stakeOf, type Round } from './blackjackRules';
import { evaluateHand } from './videoPokerRules';
import { newKlondike, moveCards, outcome, type KState } from './klondikeRules';
import { guessHigherLower, guessJackpot, startHigherLower } from './higherLowerRules';
import { dealThird, startRedDog } from './redDogRules';
import { bankerDraws, handTotal as baccaratTotal, playBaccarat } from './baccaratRules';
import {
  botTurn,
  drawForPlayer,
  isPlayable,
  playCard,
  returnedFor,
  startCrazyEights,
  type CrazyEightsState,
} from './crazyEightsRules';

const c = (rank: number, suit: Card['suit'] = 'spades'): Card => ({ rank, suit });

function round(player: Card[], dealer: Card[], bet = 10, extra: Partial<Round> = {}): Round {
  return { deck: [], player, dealer, bet, doubled: false, over: false, returned: 0, ...extra };
}

describe('blackjack', () => {
  it('counts aces as 11 or 1 to avoid busting', () => {
    expect(handValue([c(1), c(13)])).toEqual({ total: 21, soft: true });
    expect(handValue([c(1), c(13), c(9)])).toEqual({ total: 20, soft: false });
    expect(handValue([c(1), c(1), c(9)])).toEqual({ total: 21, soft: true });
  });

  it('pays 3:2 for a natural and 1:1 for a normal win', () => {
    const natural = stand(round([c(1), c(13)], [c(10), c(8)]));
    expect(natural.outcome).toBe('blackjack');
    expect(natural.returned).toBe(25); // 10 bet -> 25 back

    const win = stand(round([c(10), c(10)], [c(10), c(7)]));
    expect(win.outcome).toBe('win');
    expect(win.returned).toBe(20);
  });

  it('loses the stake on a bust and returns it on a push', () => {
    const bust = stand(round([c(10), c(10), c(5)], [c(10), c(7)]));
    expect(bust.outcome).toBe('bust');
    expect(bust.returned).toBe(0);

    const push = stand(round([c(10), c(9)], [c(10), c(9)]));
    expect(push.outcome).toBe('push');
    expect(push.returned).toBe(10);
  });

  it('doubles the stake and settles the doubled amount', () => {
    const doubled = { ...round([c(10), c(9)], [c(10), c(7)]), doubled: true };
    expect(stakeOf(doubled)).toBe(20);
    const result = stand(doubled);
    expect(result.outcome).toBe('win');
    expect(result.returned).toBe(40);
  });

  it('settles immediately when the dealt hand is a natural', () => {
    const deck: Card[] = [c(1, 'hearts'), c(10, 'hearts'), c(9, 'clubs'), c(8, 'clubs')];
    const r = dealRound(deck, 10);
    expect(r.over).toBe(true);
  });
});

describe('video poker hand evaluation', () => {
  it('recognises the main hands', () => {
    expect(evaluateHand([c(1), c(10), c(11), c(12), c(13)]).name).toBe('Royal Flush');
    expect(evaluateHand([c(5, 'hearts'), c(6, 'hearts'), c(7, 'hearts'), c(8, 'hearts'), c(9, 'hearts')]).name).toBe(
      'Straight Flush',
    );
    expect(evaluateHand([c(9), c(9, 'hearts'), c(9, 'clubs'), c(9, 'diamonds'), c(2)]).name).toBe('Four of a Kind');
    expect(evaluateHand([c(9), c(9, 'hearts'), c(9, 'clubs'), c(4), c(4, 'hearts')]).name).toBe('Full House');
    expect(evaluateHand([c(1), c(2, 'hearts'), c(3), c(4), c(5)]).name).toBe('Straight');
    expect(evaluateHand([c(2), c(2, 'hearts'), c(7), c(7, 'clubs'), c(12)]).name).toBe('Two Pair');
  });

  it('only pays a pair of jacks or better', () => {
    expect(evaluateHand([c(11), c(11, 'hearts'), c(2), c(5), c(8)]).multiplier).toBe(1);
    expect(evaluateHand([c(10), c(10, 'hearts'), c(2), c(5), c(8)]).multiplier).toBe(0);
  });
});

describe('klondike', () => {
  const deck: Card[] = [];
  for (const suit of ['clubs', 'diamonds', 'hearts', 'spades'] as const) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }

  it('deals 28 cards to the tableau and 24 to the stock', () => {
    const s = newKlondike(deck);
    expect(s.tableau.reduce((n, col) => n + col.length, 0)).toBe(28);
    expect(s.stock.length).toBe(24);
    s.tableau.forEach((col) => expect(col[col.length - 1].up).toBe(true));
  });

  it('only allows legal tableau placements (opposite colour, one lower)', () => {
    const s: KState = {
      stock: [],
      waste: [c(6, 'hearts')],
      foundations: [[], [], [], []],
      tableau: [[{ rank: 7, suit: 'spades', up: true }], [], [], [], [], [], []],
      recyclesLeft: 0,
    };
    // 6 of hearts onto 7 of spades: legal.
    expect(moveCards(s, { from: 'waste' }, { to: 'tableau', col: 0 })).not.toBeNull();
    // 6 of hearts onto 7 of hearts: illegal (same colour).
    const bad: KState = { ...s, tableau: [[{ rank: 7, suit: 'hearts', up: true }], [], [], [], [], [], []] };
    expect(moveCards(bad, { from: 'waste' }, { to: 'tableau', col: 0 })).toBeNull();
  });

  it('reports a win when all foundations are complete', () => {
    const full = Array.from({ length: 4 }, (_, p) =>
      Array.from({ length: 13 }, (_, r) => ({ rank: r + 1, suit: (['clubs', 'diamonds', 'hearts', 'spades'] as const)[p] })),
    );
    const s: KState = { stock: [], waste: [], foundations: full, tableau: Array(7).fill([]), recyclesLeft: 0 };
    expect(outcome(s)).toBe('won');
  });
});

describe('higher or lower', () => {
  it('a tie is a loss and a correct guess grows the pot', () => {
    const base = startHigherLower([c(5), c(9)], 10);
    expect(guessHigherLower(base, 'higher').status).toBe('playing');
    expect(guessHigherLower(base, 'higher').pot).toBe(15);
    const tie = startHigherLower([c(5), c(5, 'hearts')], 10);
    expect(guessHigherLower(tie, 'higher').status).toBe('lost');
    expect(guessHigherLower(tie, 'lower').status).toBe('lost');
  });
});

describe('higher or lower jackpot', () => {
  it('pays 12× the pot when the next card has the same rank', () => {
    const s = startHigherLower([c(7), c(7, 'hearts')], 10);
    const won = guessJackpot(s);
    expect(won.status).toBe('jackpot');
    expect(won.pot).toBe(120);
  });

  it('loses the pot when the rank differs, even if higher or lower would have won', () => {
    const s = startHigherLower([c(7), c(9)], 10);
    expect(guessJackpot(s).status).toBe('lost');
  });
});

describe('red dog', () => {
  it('pays 5, 4, 2 and 1 to 1 as the spread widens', () => {
    expect(dealThird(startRedDog([c(4), c(6), c(5)], 10)).returned).toBe(60); // spread 1
    expect(dealThird(startRedDog([c(4), c(7), c(5)], 10)).returned).toBe(50); // spread 2
    expect(dealThird(startRedDog([c(4), c(8), c(6)], 10)).returned).toBe(30); // spread 3
    expect(dealThird(startRedDog([c(4), c(9), c(6)], 10)).returned).toBe(20); // spread 4
    expect(dealThird(startRedDog([c(2), c(13), c(7)], 10)).returned).toBe(20); // spread 10 is still 1 to 1
  });

  it('orders the opening cards and loses when the third card is outside or on a boundary', () => {
    const s = startRedDog([c(9), c(4), c(4, 'hearts')], 10);
    expect(s.cards.map((x) => x.rank)).toEqual([4, 9]);
    expect(dealThird(s)).toMatchObject({ status: 'lost', returned: 0 });
    expect(dealThird(startRedDog([c(4), c(9), c(9, 'hearts')], 10)).status).toBe('lost');
    expect(dealThird(startRedDog([c(4), c(9), c(13)], 10)).status).toBe('lost');
  });

  it('treats aces as high', () => {
    // 2 and Ace leave 3 to King in between.
    expect(dealThird(startRedDog([c(2), c(1), c(5)], 10)).status).toBe('won');
    // King and Ace are consecutive.
    expect(startRedDog([c(13), c(1), c(5)], 10)).toMatchObject({ status: 'push', spread: 0 });
  });

  it('pushes consecutive cards without dealing a third card', () => {
    const s = startRedDog([c(5), c(6), c(9)], 10);
    expect(s).toMatchObject({ status: 'push', returned: 10, third: null });
    expect(dealThird(s, 10)).toBe(s);
  });

  it('pays 11 to 1 for three of a kind and pushes any other third card after a pair', () => {
    expect(startRedDog([c(7), c(7, 'hearts'), c(7, 'clubs')], 10)).toMatchObject({ status: 'won', returned: 120 });
    expect(startRedDog([c(7), c(7, 'hearts'), c(8)], 10)).toMatchObject({ status: 'push', returned: 10 });
  });

  it('applies a raise to the stake, capped at the original bet', () => {
    const half = dealThird(startRedDog([c(4), c(9), c(6)], 10), 5);
    expect(half).toMatchObject({ raise: 5, returned: 30 }); // 15 staked at 1 to 1
    const capped = dealThird(startRedDog([c(4), c(9), c(6)], 10), 50);
    expect(capped).toMatchObject({ raise: 10, returned: 40 });
    expect(dealThird(startRedDog([c(4), c(9), c(2)], 10), 10).returned).toBe(0);
  });
});

describe('baccarat', () => {
  it('scores face cards as 0, aces as 1, and keeps only the last digit', () => {
    expect(baccaratTotal([c(13), c(12)])).toBe(0);
    expect(baccaratTotal([c(1), c(9)])).toBe(0); // 10
    expect(baccaratTotal([c(7), c(8)])).toBe(5); // 15
    expect(baccaratTotal([c(9), c(9), c(9)])).toBe(7); // 27
  });

  // Deal order is player, banker, player, banker, then any third cards (player first).
  it('stops on a natural, so nobody draws', () => {
    const r = playBaccarat([c(4), c(2), c(5), c(10), c(7), c(7)], 'player', 10);
    expect(r).toMatchObject({ natural: true, winner: 'player', returned: 20 });
    expect(r.player).toHaveLength(2);
    expect(r.banker).toHaveLength(2);
  });

  it('has the player draw on 0 to 5 and stand on 6 or 7', () => {
    const draws = playBaccarat([c(2), c(10), c(3), c(10), c(4), c(1)], 'player', 10);
    expect(draws.player).toHaveLength(3); // 5 draws
    const stands = playBaccarat([c(3), c(10), c(3), c(10), c(2), c(1)], 'player', 10);
    expect(stands.player).toHaveLength(2); // 6 stands
  });

  it("has the banker draw on 0 to 5 when the player stands", () => {
    // Player 3+3 = 6 stands, banker 2+3 = 5 draws a 4 for 9.
    const r = playBaccarat([c(3), c(2), c(3), c(3), c(4)], 'banker', 10);
    expect(r.banker).toHaveLength(3);
    expect(r.winner).toBe('banker');
    // Banker 6 stands when the player stood.
    expect(playBaccarat([c(3), c(3), c(3), c(3), c(4)], 'banker', 10).banker).toHaveLength(2);
  });

  it("follows the banker's third-card table when the player drew", () => {
    // banker total -> player third card values on which the banker draws
    const table: Record<number, number[]> = {
      0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      1: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      2: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      3: [0, 1, 2, 3, 4, 5, 6, 7, 9],
      4: [2, 3, 4, 5, 6, 7],
      5: [4, 5, 6, 7],
      6: [6, 7],
      7: [],
    };
    for (const [total, draws] of Object.entries(table)) {
      for (let third = 0; third <= 9; third++) {
        expect(bankerDraws(Number(total), third), `banker ${total}, player third ${third}`).toBe(draws.includes(third));
      }
    }
  });

  it('pays 1 to 1 on Player and returns the stake on a tie for Player and Banker bets', () => {
    expect(playBaccarat([c(2), c(4), c(3), c(5)], 'player', 10).returned).toBe(0); // banker 9 beats player 5
    // Both hands are a natural 8: a tie.
    const tie = [c(4), c(3), c(4), c(5)];
    expect(playBaccarat(tie, 'player', 10)).toMatchObject({ winner: 'tie', returned: 10 });
    expect(playBaccarat(tie, 'banker', 10).returned).toBe(10);
    expect(playBaccarat(tie, 'tie', 10).returned).toBe(90); // 8 to 1
  });

  it('takes a 5% commission on Banker wins, rounded down to a whole coin', () => {
    const bankerWins = [c(2), c(4), c(3), c(5)]; // banker natural 9
    expect(playBaccarat(bankerWins, 'banker', 10).returned).toBe(19); // 19.5 rounded down
    expect(playBaccarat(bankerWins, 'banker', 100).returned).toBe(195);
    expect(playBaccarat(bankerWins, 'tie', 10).returned).toBe(0);
  });
});

describe('crazy eights', () => {
  const FILLER = Array.from({ length: 30 }, (_, i) => c(2 + (i % 5), (['clubs', 'diamonds', 'hearts', 'spades'] as const)[i % 4]));

  /** A deck that deals `player` and `bot` hands (alternating), then `starter`, then the rest. */
  function deck(player: Card[], bot: Card[], starter: Card, rest: Card[] = FILLER): Card[] {
    const dealt: Card[] = [];
    for (let i = 0; i < 7; i++) dealt.push(player[i], bot[i]);
    return [...dealt, starter, ...rest];
  }
  const pad = (cards: Card[], filler: Card) => [...cards, ...Array(7 - cards.length).fill(filler)];

  /** A running game with chosen hands, the top card showing, and a stock to draw from. */
  function game(over: Partial<CrazyEightsState>): CrazyEightsState {
    return {
      stock: [], discard: [c(7, 'hearts')], player: [c(3, 'clubs')], bot: [c(4, 'clubs')],
      suit: 'hearts', turn: 'player', status: 'playing', passes: 0, bet: 10, log: '', ...over,
    };
  }

  it('deals 7 cards each and turns up a starter, burying an 8', () => {
    const p = pad([], c(2, 'clubs'));
    const b = pad([], c(3, 'clubs'));
    const s = startCrazyEights(deck(p, b, c(8, 'hearts'), [c(9, 'spades'), c(5, 'clubs')]), 10);
    expect(s.player).toHaveLength(7);
    expect(s.bot).toHaveLength(7);
    expect(s.discard).toEqual([c(9, 'spades')]); // the 8 was skipped
    expect(s.suit).toBe('spades');
    expect(s.stock[s.stock.length - 1]).toEqual(c(8, 'hearts')); // and buried at the bottom
    expect(s.turn).toBe('player');
  });

  it('allows a match on suit or rank, and always allows an 8', () => {
    const s = game({ discard: [c(7, 'hearts')], suit: 'hearts' });
    expect(isPlayable(c(13, 'hearts'), s)).toBe(true); // suit
    expect(isPlayable(c(7, 'spades'), s)).toBe(true); // rank
    expect(isPlayable(c(8, 'clubs'), s)).toBe(true); // wild
    expect(isPlayable(c(3, 'diamonds'), s)).toBe(false);
  });

  it('plays a card, moves it to the pile, and passes the turn', () => {
    const s = playCard(game({ player: [c(7, 'spades'), c(3, 'clubs')] }), 0);
    expect(s.discard[s.discard.length - 1]).toEqual(c(7, 'spades'));
    expect(s.suit).toBe('spades');
    expect(s.player).toEqual([c(3, 'clubs')]);
    expect(s.turn).toBe('bot');
  });

  it("refuses a card that doesn't match, or a play out of turn", () => {
    const s = game({ player: [c(3, 'diamonds')] });
    expect(playCard(s, 0)).toBe(s);
    expect(playCard({ ...s, player: [c(13, 'hearts')], turn: 'bot' }, 0).player).toHaveLength(1);
  });

  it('lets an 8 set the suit, and the next card must match it', () => {
    const s = playCard(game({ player: [c(8, 'clubs'), c(3, 'clubs')] }), 0, 'diamonds');
    expect(s.suit).toBe('diamonds');
    expect(isPlayable(c(5, 'diamonds'), s)).toBe(true);
    expect(isPlayable(c(5, 'hearts'), s)).toBe(false);
  });

  it('wins when the last card is played, paying 2 times the bet', () => {
    const s = playCard(game({ player: [c(9, 'hearts')], bet: 10 }), 0);
    expect(s.status).toBe('won');
    expect(returnedFor(s)).toBe(20);
  });

  it('draws until a playable card turns up, and only when nothing can be played', () => {
    const stuck = game({ player: [c(3, 'clubs')], stock: [c(4, 'spades'), c(5, 'clubs'), c(9, 'hearts'), c(2, 'spades')] });
    const s = drawForPlayer(stuck);
    expect(s.player.map((x) => x.rank)).toEqual([3, 4, 5, 9]); // stopped at the 9 of hearts
    expect(s.stock).toHaveLength(1);
    expect(s.turn).toBe('player');

    const canPlay = game({ player: [c(7, 'clubs')], stock: [c(9, 'hearts')] });
    expect(drawForPlayer(canPlay)).toBe(canPlay);
  });

  it('refills the stock from the pile (keeping the top card) when it runs out', () => {
    const s = drawForPlayer(game({
      player: [c(3, 'clubs')], stock: [],
      discard: [c(2, 'spades'), c(4, 'spades'), c(9, 'hearts'), c(7, 'hearts')],
    }));
    expect(s.discard).toEqual([c(7, 'hearts')]);
    expect(s.player.length).toBeGreaterThan(1);
  });

  it('plays a draw when both sides pass with nothing left to draw', () => {
    const s0 = game({ player: [c(3, 'clubs')], bot: [c(4, 'clubs')], stock: [] });
    const afterPlayer = drawForPlayer(s0);
    expect(afterPlayer).toMatchObject({ turn: 'bot', passes: 1, status: 'playing' });
    const afterBot = botTurn(afterPlayer);
    expect(afterBot.status).toBe('draw');
    expect(returnedFor(afterBot)).toBe(10);
  });

  it('has the bot play ordinary cards before its 8s', () => {
    const s = botTurn(game({ turn: 'bot', bot: [c(8, 'clubs'), c(13, 'hearts'), c(3, 'spades')] }));
    expect(s.discard[s.discard.length - 1]).toEqual(c(13, 'hearts'));
    expect(s.bot).toHaveLength(2);
    expect(s.turn).toBe('player');
  });

  it('has the bot use an 8 as a last resort and choose the suit it holds most of', () => {
    const s = botTurn(game({
      turn: 'bot', suit: 'hearts', discard: [c(7, 'hearts')],
      bot: [c(8, 'clubs'), c(3, 'spades'), c(5, 'spades'), c(9, 'diamonds')],
    }));
    expect(s.discard[s.discard.length - 1]).toEqual(c(8, 'clubs'));
    expect(s.suit).toBe('spades');
  });

  it('has the bot draw until it can play, and lose the round for the player when it goes out', () => {
    const drew = botTurn(game({ turn: 'bot', bot: [c(3, 'clubs')], stock: [c(4, 'spades'), c(9, 'hearts')] }));
    expect(drew.discard[drew.discard.length - 1]).toEqual(c(9, 'hearts'));
    expect(drew.bot.map((x) => x.rank)).toEqual([3, 4]);

    const out = botTurn(game({ turn: 'bot', bot: [c(9, 'hearts')], bet: 10 }));
    expect(out.status).toBe('lost');
    expect(returnedFor(out)).toBe(0);
  });
});
