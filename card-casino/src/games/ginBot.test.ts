import { describe, expect, it } from 'vitest';
import { newDeck, shuffle } from '../cards';
import { botStep } from './ginBot';
import { dealHand, discardCard, drawFromStock, passUpcard, type GinHand } from './ginRules';
import { handOf } from './ginTestUtils';

const bot = (spec: Parameters<typeof handOf>[0]) => handOf({ turn: 'bot', ...spec });
const names = (list: { rank: number; suit: string }[]) => list.map((c) => `${c.rank}${c.suit[0]}`).join(' ');

// 10 cards: a set of 7s, a run 2-3-4 of spades, and four loose cards.
const TEN = '7h 7d 7c 2s 3s 4s 9c Kh 6c Ad';

describe('the bot on the first card', () => {
  it('takes it when it completes a set', () => {
    const h = botStep(bot({ player: TEN, bot: '7h 7d 2s 3s 4s Kc Qd 9c 5h Ad', discard: '7c', phase: 'offer' }));
    expect(h.bot).toHaveLength(11);
    expect(h.phase).toBe('discard');
    expect(h.log).toMatch(/took the 7♣/);
  });

  it('takes it when it extends a run', () => {
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s Kc Qd 9c Ad', discard: '5s', phase: 'offer' }));
    expect(h.phase).toBe('discard');
    expect(h.bot).toHaveLength(11);
  });

  it('passes on a card that fits nothing', () => {
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s Kc Qd 9c Ad', discard: '9h', phase: 'offer' }));
    expect(h.phase).toBe('offer');
    expect(h.passes).toBe(1);
    expect(h.turn).toBe('player');
    expect(h.log).toMatch(/passed/);
  });

  it('does not take a low card just to throw a high one away', () => {
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s Kc Qd Jc 9d', discard: '5h', phase: 'offer' }));
    expect(h.phase).toBe('offer');
  });
});

describe('the bot drawing', () => {
  it('takes the pile card when it makes a meld', () => {
    const h = botStep(bot({ player: TEN, bot: TEN, discard: '5s', phase: 'draw' }));
    expect(h.phase).toBe('discard');
    expect(h.discard).toHaveLength(0);
    expect(h.bot).toHaveLength(11);
  });

  it('draws from the stock otherwise', () => {
    const h = botStep(bot({ player: TEN, bot: TEN, discard: '9h', phase: 'draw' }));
    expect(h.phase).toBe('discard');
    expect(h.discard).toHaveLength(1);
    expect(h.stock).toHaveLength(19);
    expect(h.log).toMatch(/stock/);
  });

  it('draws from the stock when it has to, even if the pile card would fit', () => {
    const h = botStep(bot({ player: TEN, bot: TEN, discard: '5s', phase: 'draw', passes: 2 }));
    expect(h.discard).toHaveLength(1);
    expect(h.stock).toHaveLength(19);
  });

  it('does nothing when it is not its turn', () => {
    const h = handOf({ player: TEN, bot: TEN, turn: 'player', phase: 'draw' });
    expect(botStep(h)).toBe(h);
  });
});

describe('the bot discarding', () => {
  // 11 cards: set of 7s, run 2-3-4 of spades, and loose 9c Kh Qd 6c Ad.
  const ELEVEN = '7h 7d 7c 2s 3s 4s 9c Kh Qd 6c Ad';

  it('throws away a loose card worth the most', () => {
    const h = botStep(bot({ player: TEN, bot: ELEVEN }));
    const last = h.discard[h.discard.length - 1];
    expect(last.rank).toBeGreaterThanOrEqual(12);
    expect(h.bot).toHaveLength(10);
    expect(h.turn).toBe('player');
    expect(h.phase).toBe('draw');
  });

  it('never throws back the card it just took from the pile', () => {
    const h = botStep(bot({ player: TEN, bot: ELEVEN, taken: 'Kh' }));
    expect(names(h.discard.slice(-1))).not.toBe('13h');
    expect(names(h.bot.filter((c) => c.rank === 13))).toBe('13h');
  });

  it('prefers the discard that cannot help you, going by what you picked up from the pile', () => {
    // Kh and Kd are equally good to throw. You took the Qh, so the Kh could join it in a run.
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s 9c Kh Kd 6c Ad', playerTook: 'Qh' }));
    expect(names(h.discard.slice(-1))).toBe('13d');
  });
});

describe('the bot knocking', () => {
  // Discarding the Qd leaves the bot a set, two runs and one loose 3c: 3 points.
  const KNOCKABLE = '7h 7d 7c 2s 3s 4s 8s 9s Ts 3c Qd';

  it('knocks late in the hand when it has little deadwood', () => {
    const h = botStep(bot({ player: TEN, bot: KNOCKABLE, stock: 'Ac Ad Ah 2c 2d 2h 3d 3h' }));
    expect(h.phase).toBe('over');
    expect(h.result?.knocker).toBe('bot');
    expect(h.result?.knockerPoints).toBe(3);
  });

  it('waits for gin instead of knocking when plenty of cards would make it', () => {
    // One loose card. The A, 5 or J of spades, or the last 7, would each give gin, and there is lots of stock left.
    const h = botStep(bot({ player: TEN, bot: KNOCKABLE }));
    expect(h.phase).toBe('draw');
    expect(h.result).toBeNull();
    expect(h.turn).toBe('player');
  });

  it('goes gin whenever it can', () => {
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s 8s 9s Ts Js Ac' }));
    expect(h.phase).toBe('over');
    expect(h.result).toMatchObject({ kind: 'gin', winner: 'bot' });
  });

  it('does not knock early when it has more than a few points left', () => {
    // The 5c left over would be 5 points. With a full stock the bot wants 4 or fewer.
    const stock = Array.from({ length: 25 }, (_, i) => `${(i % 9) + 2}${'cdhs'[i % 4]}`).join(' ');
    const h = botStep(bot({ player: TEN, bot: '7h 7d 7c 2s 3s 4s 8s 9s Ts 5c Qd', stock }));
    expect(h.phase).toBe('draw');
  });
});

/** A trivial opponent for the bot to play against: always passes, draws from the stock, and discards its first card. */
function dumbPlayer(h: GinHand): GinHand {
  if (h.phase === 'offer') return passUpcard(h);
  if (h.phase === 'draw') return drawFromStock(h);
  return discardCard(h, 0);
}

describe('whole hands', () => {
  it('always end with a result, with every card accounted for', () => {
    for (let game = 0; game < 40; game++) {
      let h = dealHand(shuffle(newDeck()), game % 2 ? 'bot' : 'player');
      for (let steps = 0; h.phase !== 'over' && steps < 400; steps++) h = h.turn === 'bot' ? botStep(h) : dumbPlayer(h);
      expect(h.phase).toBe('over');
      expect(h.result).not.toBeNull();
      expect(h.player.length + h.bot.length + h.stock.length + h.discard.length).toBe(52);
    }
  });

  it('are won by the bot more often than not against a player who never picks up the pile', () => {
    let botWins = 0;
    let decided = 0;
    for (let game = 0; game < 60; game++) {
      let h = dealHand(shuffle(newDeck()), game % 2 ? 'bot' : 'player');
      for (let steps = 0; h.phase !== 'over' && steps < 400; steps++) h = h.turn === 'bot' ? botStep(h) : dumbPlayer(h);
      if (h.result?.winner) {
        decided++;
        if (h.result.winner === 'bot') botWins++;
      }
    }
    expect(decided).toBeGreaterThan(20);
    expect(botWins / decided).toBeGreaterThan(0.7);
  });
});
