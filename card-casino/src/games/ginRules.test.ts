import { describe, expect, it } from 'vitest';
import {
  GIN_BONUS,
  HAND_BONUS,
  MATCH_BONUS,
  UNDERCUT_BONUS,
  arrange,
  bestLayoff,
  canAttach,
  dealHand,
  discardCard,
  drawFromPile,
  drawFromStock,
  finalScores,
  forfeit,
  knock,
  knockOption,
  mustDrawStock,
  nextHand,
  passUpcard,
  returnedFor,
  startMatch,
  takeUpcard,
  updateHand,
} from './ginRules';
import { cards, filler, handOf } from './ginTestUtils';

const names = (list: { rank: number; suit: string }[]) => list.map((c) => `${c.rank}${c.suit[0]}`).join(' ');

describe('melds and deadwood', () => {
  it('finds a set of three', () => {
    const a = arrange(cards('7s 7h 7d Ks 2c'));
    expect(a.melds).toHaveLength(1);
    expect(a.points).toBe(12); // K (10) + 2
  });

  it('finds a run, and aces are low', () => {
    expect(arrange(cards('As 2s 3s Kh')).points).toBe(10);
    expect(arrange(cards('As 2s 3s Kh')).melds).toHaveLength(1);
  });

  it('does not let a run go round the corner (Q K A)', () => {
    const a = arrange(cards('Qs Ks As'));
    expect(a.melds).toHaveLength(0);
    expect(a.points).toBe(21);
  });

  it('scores face cards as 10 and aces as 1', () => {
    expect(arrange(cards('Ks Qh Jd Ac')).points).toBe(31);
  });

  it('picks the split that leaves the least deadwood when a card could go two ways', () => {
    // 5h could join the three 5s (leaving 6h 7h loose, 13) or the 5h-6h-7h run (leaving 5s 5d loose, 10).
    const a = arrange(cards('5s 5d 5h 6h 7h'));
    expect(a.points).toBe(10);
    expect(names(a.melds[0])).toBe('5h 6h 7h');
  });

  it('prefers the arrangement with fewer points, not fewer cards', () => {
    // Option A: set of 9s (27 melded), leaving 8h 7h loose (15). Option B: run 7h 8h 9h (24 melded), leaving 9s 9d (18).
    const a = arrange(cards('9s 9d 9h 8h 7h'));
    expect(a.points).toBe(15);
    expect(a.melds[0]).toHaveLength(3);
    expect(a.melds[0].every((c) => c.rank === 9)).toBe(true);
  });

  it('can use all 10 cards: a set of four, a run of three and a run of three', () => {
    const a = arrange(cards('7s 7h 7d 7c As 2s 3s 9h Th Jh'));
    expect(a.points).toBe(0);
    expect(a.melds).toHaveLength(3);
  });

  it('handles a hand of 11 cards', () => {
    const a = arrange(cards('7s 7h 7d 4c 5c 6c 9h Th Jh 2d Kd'));
    expect(a.points).toBe(12);
    expect(names(a.deadwood)).toBe('2d 13d');
  });
});

describe('adding cards to a knock', () => {
  const melds = [cards('2h 3h 4h'), cards('9s 9d 9c')];

  it('lets a card extend a run at either end, and a set up to four', () => {
    expect(canAttach(melds[0], cards('5h')[0])).toBe(true);
    expect(canAttach(melds[0], cards('Ah')[0])).toBe(true);
    expect(canAttach(melds[0], cards('6h')[0])).toBe(false);
    expect(canAttach(melds[0], cards('5s')[0])).toBe(false);
    expect(canAttach(melds[1], cards('9h')[0])).toBe(true);
    expect(canAttach(melds[1], cards('8s')[0])).toBe(false);
    expect(canAttach([...melds[1], cards('9h')[0]], cards('9h')[0])).toBe(false); // already four
  });

  it('does not extend a run past the king or below the ace', () => {
    expect(canAttach(cards('Js Qs Ks'), cards('As')[0])).toBe(false);
    expect(canAttach(cards('As 2s 3s'), cards('Ks')[0])).toBe(false);
  });

  it('lays off a chain of cards that only fit one after another', () => {
    const r = bestLayoff(cards('5h 6h 7h Kc Qd Js 3c 4d 2s 8c'), melds);
    expect(r.laidOff.map((c) => c.rank).sort((a, b) => a - b)).toEqual([5, 6, 7]);
    expect(r.knockerMelds[0]).toHaveLength(6);
    expect(r.remaining.points).toBe(10 + 10 + 10 + 3 + 4 + 2 + 8);
  });

  it('lays off the cards that save the most points and leaves the rest', () => {
    const r = bestLayoff(cards('9h Kc 2s 3d 4c 5d 6s 7c 8d Qh'), melds);
    expect(names(r.laidOff)).toBe('9h'.replace('9h', '9h'));
    expect(r.remaining.points).toBeLessThan(arrange(cards('9h Kc 2s 3d 4c 5d 6s 7c 8d Qh')).points);
  });

  it('can take a card out of its own run to lay it off, when that helps', () => {
    // The 9h is the end of the run 6h-7h-8h-9h. It fits the knocker's set of 9s, and the run of three stays whole.
    const r = bestLayoff(cards('6h 7h 8h 9h Kc Qd 2s 4d Js 3c'), [cards('9s 9d 9c')]);
    expect(names(r.laidOff)).toBe('9h');
    expect(r.remaining.points).toBe(10 + 10 + 2 + 4 + 10 + 3);
    expect(names(r.remaining.melds[0])).toBe('6h 7h 8h');
  });

  it('does not lay off a card when keeping it in a meld is better', () => {
    // The 5h is part of the set of fives. Laying it on the run would break the set and leave 10 points loose.
    const r = bestLayoff(cards('5s 5d 5h Kc Qd Js 7c 8d 9h Ts'), [cards('2h 3h 4h')]);
    expect(r.laidOff).toEqual([]);
  });

  it('lays nothing off when nothing fits', () => {
    const r = bestLayoff(cards('Ks Qd Jc 8s 6d'), melds);
    expect(r.laidOff).toEqual([]);
    expect(r.remaining.points).toBe(arrange(cards('Ks Qd Jc 8s 6d')).points);
  });
});

describe('the start of a hand', () => {
  it('deals 10 each and one card up, with the player who is not dealing going first', () => {
    const h = dealHand(filler(52), 'bot');
    expect(h.player).toHaveLength(10);
    expect(h.bot).toHaveLength(10);
    expect(h.discard).toHaveLength(1);
    expect(h.stock).toHaveLength(31);
    expect(h.turn).toBe('player');
    expect(h.phase).toBe('offer');
  });

  it('lets the first player take the up card', () => {
    const h = takeUpcard(dealHand(filler(52), 'bot'));
    expect(h.player).toHaveLength(11);
    expect(h.discard).toHaveLength(0);
    expect(h.phase).toBe('discard');
    expect(h.turn).toBe('player');
  });

  it('offers it to the dealer if the first player passes', () => {
    const h = passUpcard(dealHand(filler(52), 'bot'));
    expect(h.turn).toBe('bot');
    expect(h.phase).toBe('offer');
    expect(takeUpcard(h).bot).toHaveLength(11);
  });

  it('makes the first player draw from the stock when both pass', () => {
    const h = passUpcard(passUpcard(dealHand(filler(52), 'bot')));
    expect(h.turn).toBe('player');
    expect(h.phase).toBe('draw');
    expect(mustDrawStock(h)).toBe(true);
    expect(drawFromPile(h)).toBe(h); // the pile is not allowed this once
    expect(drawFromStock(h).player).toHaveLength(11);
    expect(mustDrawStock(drawFromStock(h))).toBe(false);
  });
});

describe('a turn', () => {
  const h = () => handOf({ player: '2s 3s 4s 7h 7d 7c 9c Td Kh Qd', bot: 'As 5d 8c Jh 3d 6h 9s Ks 4c 2h', discard: '5s', phase: 'draw', turn: 'player' });

  it('draws from the stock, or takes the pile card', () => {
    const fromStock = drawFromStock(h());
    expect(fromStock.player).toHaveLength(11);
    expect(fromStock.stock).toHaveLength(19);
    const fromPile = drawFromPile(h());
    expect(fromPile.player).toHaveLength(11);
    expect(fromPile.discard).toHaveLength(0);
    expect(fromPile.playerTook).toHaveLength(1);
  });

  it('remembers what the player picked up from the pile, but not what they drew', () => {
    expect(drawFromStock(h()).playerTook).toHaveLength(0);
    expect(drawFromPile(h()).playerTook).toHaveLength(1);
  });

  it('does not let you throw back the card you just took from the pile', () => {
    const taken = drawFromPile(h());
    const index = taken.player.findIndex((c) => c.rank === 5 && c.suit === 'spades');
    expect(discardCard(taken, index)).toBe(taken);
    expect(knockOption(taken, index).allowed).toBe(false);
    // a different card is fine
    expect(discardCard(taken, 0).phase).toBe('draw');
  });

  it('lets you throw back a card you drew from the stock, and passes the turn', () => {
    const drew = drawFromStock(h());
    const next = discardCard(drew, 10);
    expect(next.player).toHaveLength(10);
    expect(next.turn).toBe('bot');
    expect(next.phase).toBe('draw');
    expect(next.discard).toHaveLength(2);
  });

  it('ignores moves made out of turn or in the wrong phase', () => {
    const start = h();
    expect(discardCard(start, 0)).toBe(start); // must draw first
    const drew = drawFromStock(start);
    expect(drawFromStock(drew)).toBe(drew); // already drew
  });

  it('ends the hand as a draw when only 2 cards are left in the stock after a discard', () => {
    const near = drawFromStock(handOf({ player: '2s 3s 4s 7h 7d 7c 9c Td Kh Qd', bot: 'As 5d 8c Jh 3d 6h 9s Ks 4c 2h', phase: 'draw', stock: 'Ac Ad Ah' }));
    expect(near.stock).toHaveLength(2);
    const over = discardCard(near, 10);
    expect(over.phase).toBe('over');
    expect(over.result).toMatchObject({ kind: 'draw', winner: null, points: 0 });
  });
});

describe('knocking', () => {
  // The player's 11 cards: a set of 7s, the runs 2-3-4 and 8-9-10 of spades, then 3c and Qd. Discarding Qd leaves 3 points.
  const KNOCKER = '7h 7d 7c 2s 3s 4s 8s 9s Ts 3c Qd';
  const knockWith = (bot: string, player = KNOCKER) => knock(handOf({ player, bot, phase: 'discard' }), 10);

  it('only lets you knock with 10 or fewer deadwood points', () => {
    const h = handOf({ player: '7h 7d 7c 2s 3s 4s 9c Td Kh Qd 5d', bot: 'As 5s 8c Jh 3d 6h 9s Ks 4c 2h', phase: 'discard' });
    expect(knockOption(h, 10)).toEqual({ allowed: false, points: 39 }); // discarding 5d leaves 9+10+10+10
    expect(knock(h, 10)).toBe(h);
  });

  it('shows what a knock would leave you with', () => {
    const h = handOf({ player: KNOCKER, bot: 'As 5s 8c Jh 3d 6h 9s Ks 4c 2h', phase: 'discard' });
    expect(knockOption(h, 10)).toEqual({ allowed: true, points: 3 });
  });

  it('goes gin when nothing is left over, and the other player cannot lay anything off', () => {
    // The bot holds As, which would fit the 2-3-4 run, but there are no layoffs against gin.
    const end = knockWith('6s 6h Kd Qd Jc 3c 4d 8h As 2d', '7h 7d 7c 2s 3s 4s 8s 9s Ts Js Ac');
    expect(end.phase).toBe('over');
    expect(end.result).toMatchObject({ kind: 'gin', winner: 'player', knocker: 'player', knockerPoints: 0, otherPoints: 60, laidOff: [], bonus: GIN_BONUS });
    expect(end.result!.points).toBe(60 + GIN_BONUS);
  });

  it('scores a knock as the difference in deadwood, after the other player lays off what they can', () => {
    // The bot has 65 loose points, but its 5s fits the run 2-3-4 of spades, taking it to 60.
    const end = knockWith('Kd Qs Jc 9h 6d 5s 2c Ah 8d 4h');
    expect(end.result).toMatchObject({ kind: 'knock', winner: 'player', knocker: 'player', knockerPoints: 3, otherPoints: 60, bonus: 0, points: 57 });
    expect(names(end.result!.laidOff!)).toBe('5s');
    expect(end.result!.knockerMelds!.some((m) => m.length === 4 && m[0].suit === 'spades')).toBe(true);
  });

  it('is an undercut when the other player has less than the knocker, worth 25 extra to them', () => {
    // Bot: sets of aces, nines and nothing else but a 2 left over.
    const end = knockWith('Ah Ac Ad 9d 9c 9h 5d 5c 5h 2d');
    expect(end.result).toMatchObject({ kind: 'undercut', winner: 'bot', knocker: 'player', knockerPoints: 3, otherPoints: 2, bonus: UNDERCUT_BONUS, points: 3 - 2 + UNDERCUT_BONUS });
  });

  it('is an undercut when the other player ties the knocker', () => {
    const end = knockWith('Ah Ac Ad 9d 9c 9h 5d 5c 5h 3d');
    expect(end.result).toMatchObject({ kind: 'undercut', winner: 'bot', otherPoints: 3, points: UNDERCUT_BONUS });
  });

  it('lets laying off turn a knock into an undercut', () => {
    // The knocker has 5 left. The bot has 15 loose points, but its 5s and 6s go on the run 2-3-4, leaving 4.
    const end = knockWith('5s 6s 2d 2h Ah Ac Ad 9d 9c 9h', '7h 7d 7c 2s 3s 4s 8s 9s Ts 5c Qd');
    expect(end.result).toMatchObject({ kind: 'undercut', winner: 'bot', knockerPoints: 5, otherPoints: 4, points: 5 - 4 + UNDERCUT_BONUS });
    expect(names(end.result!.laidOff!)).toBe('5s 6s');
  });

  it('leaves the knocker with the 10 cards they kept, and the knocked card on the pile', () => {
    const end = knockWith('Kd Qs Jc 9h 6d 5s 2c Ah 8d 4h');
    expect(end.player).toHaveLength(10);
    expect(end.discard[end.discard.length - 1]).toMatchObject({ rank: 12, suit: 'diamonds' });
  });
});

describe('a match', () => {
  const deck = filler(52);

  it('starts at 0-0 with the first hand dealt', () => {
    const m = startMatch(deck, 50, 'bot');
    expect(m.scores).toEqual({ player: 0, bot: 0 });
    expect(m.handNumber).toBe(1);
    expect(m.status).toBe('playing');
  });

  const finishedHand = (m: ReturnType<typeof startMatch>, winner: 'player' | 'bot', points: number) =>
    updateHand(m, { ...m.hand, phase: 'over', result: { kind: 'knock', winner, knocker: winner, points, bonus: 0 } });

  it('adds a hand\'s points to the winner and counts the hand', () => {
    const m = finishedHand(startMatch(deck, 10, 'bot'), 'player', 37);
    expect(m.scores).toEqual({ player: 37, bot: 0 });
    expect(m.handsWon).toEqual({ player: 1, bot: 0 });
    expect(m.status).toBe('playing');
  });

  it('adds nothing for a drawn hand', () => {
    const m0 = startMatch(deck, 10, 'bot');
    const m = updateHand(m0, { ...m0.hand, phase: 'over', result: { kind: 'draw', winner: null, points: 0, bonus: 0 } });
    expect(m.scores).toEqual({ player: 0, bot: 0 });
    expect(m.handsWon).toEqual({ player: 0, bot: 0 });
  });

  it('does not count a finished hand twice', () => {
    const m = finishedHand(startMatch(deck, 10, 'bot'), 'player', 30);
    expect(updateHand(m, { ...m.hand })).toMatchObject({ scores: { player: 30, bot: 0 } });
  });

  it('ends the match when someone reaches 100, with the match and hand bonuses added', () => {
    let m = startMatch(deck, 10, 'bot');
    m = finishedHand(m, 'bot', 40);
    m = nextHand(m, deck);
    m = finishedHand(m, 'player', 30);
    m = nextHand(m, deck);
    m = finishedHand(m, 'player', 80);
    expect(m.status).toBe('won');
    expect(m.scores).toEqual({ player: 110, bot: 40 });
    expect(m.final).toEqual({ player: 110 + 2 * HAND_BONUS + MATCH_BONUS, bot: 40 + HAND_BONUS });
  });

  it('is lost when the bot reaches 100', () => {
    const m = finishedHand(startMatch(deck, 10, 'bot'), 'bot', 100);
    expect(m.status).toBe('lost');
    expect(returnedFor(m)).toBe(0);
  });

  it('pays the stake back plus the same again for a win', () => {
    const m = finishedHand(startMatch(deck, 25, 'bot'), 'player', 100);
    expect(returnedFor(m)).toBe(50);
  });

  it('deals the next hand with the other player dealing, only once the hand is over', () => {
    const m0 = startMatch(deck, 10, 'bot');
    expect(nextHand(m0, deck)).toBe(m0);
    const m = nextHand(finishedHand(m0, 'player', 10), deck);
    expect(m.hand.dealer).toBe('player');
    expect(m.handNumber).toBe(2);
    expect(m.hand.turn).toBe('bot');
  });

  it('loses the stake when you forfeit, and only once', () => {
    const m = forfeit(startMatch(deck, 10, 'bot'));
    expect(m.status).toBe('lost');
    expect(m.forfeited).toBe(true);
    expect(returnedFor(m)).toBe(0);
    const won = finishedHand(startMatch(deck, 10, 'bot'), 'player', 100);
    expect(forfeit(won)).toBe(won);
  });

  it('works out final scores', () => {
    expect(finalScores({ player: 105, bot: 60 }, { player: 3, bot: 2 }, 'player')).toEqual({ player: 105 + 60 + 100, bot: 60 + 40 });
  });
});

import { DEFAULT_RULES, PAYOUT_BY_DIFFICULTY, knockLimitFor, type GinRules } from './ginRules';

describe('the rules a match can be played by', () => {
  const rules = (over: Partial<GinRules> = {}): GinRules => ({ ...DEFAULT_RULES, ...over });
  const deck = filler(52);

  it('default to the standard game', () => {
    expect(DEFAULT_RULES).toEqual({ target: 100, knockRule: 'standard', ginBonus: 25, undercutBonus: 25 });
    const m = startMatch(deck, 10, 'bot');
    expect(m.rules).toEqual(DEFAULT_RULES);
    expect(m.difficulty).toBe('normal');
    expect(m.payout).toBe(2);
    expect(m.hand.knockLimit).toBe(10);
  });

  describe('when you may knock', () => {
    it('is 10 in the standard game, the first card in Oklahoma, and never in gin only', () => {
      const card = (rank: number) => ({ rank, suit: 'clubs' as const });
      expect(knockLimitFor('standard', card(3))).toBe(10);
      expect(knockLimitFor('oklahoma', card(1))).toBe(1); // an ace is 1
      expect(knockLimitFor('oklahoma', card(7))).toBe(7);
      expect(knockLimitFor('oklahoma', card(13))).toBe(10); // a king is 10
      expect(knockLimitFor('gin', card(7))).toBe(0);
    });

    it('is set from the card turned up at the start of each hand', () => {
      // The first card turned up in this deck is the 8 of diamonds.
      expect(dealHand(deck, 'bot', rules({ knockRule: 'oklahoma' })).knockLimit).toBe(8);
      expect(dealHand(deck, 'bot', rules({ knockRule: 'standard' })).knockLimit).toBe(10);
      expect(dealHand(deck, 'bot', rules({ knockRule: 'gin' })).knockLimit).toBe(0);
    });

    it('is worked out afresh for every hand', () => {
      let m = startMatch(deck, 10, 'bot', { rules: rules({ knockRule: 'oklahoma' }) });
      expect(m.hand.knockLimit).toBe(8);
      m = updateHand(m, { ...m.hand, phase: 'over', result: { kind: 'draw', winner: null, points: 0, bonus: 0 } });
      const next = nextHand(m, [...deck].reverse());
      expect(next.rules).toEqual(m.rules);
      expect(next.hand.knockLimit).not.toBe(8); // a different first card this time
    });

    it('decides whether you can knock', () => {
      const hand = (limit: number) => ({ ...handOf({ player: '7h 7d 7c 2s 3s 4s 9c Td Kh Qd 5d', bot: 'As 5s 8c Jh 3d 6h 9s Ks 4c 2h', phase: 'discard' }), knockLimit: limit });
      // Throwing the Kh leaves 9 + 10 + 10 + 5 = 34, too many for any limit.
      expect(knockOption(hand(10), 8).allowed).toBe(false);
      // Throwing the Qd leaves a hand of 7+7+7, 2-3-4 and loose 9 10 K 5.
      const small = { ...handOf({ player: KNOCKER_FOR_LIMITS, bot: 'As 5s 8c Jh 3d 6h 9s Ks 4c 2h', phase: 'discard' }) };
      expect(knockOption({ ...small, knockLimit: 10 }, 10)).toEqual({ allowed: true, points: 9 });
      expect(knockOption({ ...small, knockLimit: 9 }, 10).allowed).toBe(true);
      expect(knockOption({ ...small, knockLimit: 8 }, 10).allowed).toBe(false);
      expect(knockOption({ ...small, knockLimit: 0 }, 10).allowed).toBe(false);
    });

    it('lets gin only knock with nothing left over, and still allows gin', () => {
      const ginHand = { ...handOf({ player: '7h 7d 7c 2s 3s 4s 8s 9s Ts Js Ac', bot: '6s 6h Kd Qd Jc 3c 4d 8h As 2d', phase: 'discard' }), knockLimit: 0 };
      expect(knockOption(ginHand, 10)).toEqual({ allowed: true, points: 0 });
      expect(knock(ginHand, 10).result?.kind).toBe('gin');
      const notGin = { ...handOf({ player: '7h 7d 7c 2s 3s 4s 8s 9s Ts 3c Qd', bot: '6s 6h Kd Qd Jc 3c 4d 8h As 2d', phase: 'discard' }), knockLimit: 0 };
      expect(knockOption(notGin, 10)).toEqual({ allowed: false, points: 3 });
      expect(knock(notGin, 10)).toBe(notGin);
    });
  });

  describe('the bonuses', () => {
    it('can be doubled for a gin', () => {
      const h = { ...handOf({ player: '7h 7d 7c 2s 3s 4s 8s 9s Ts Js Ac', bot: '6s 6h Kd Qd Jc 3c 4d 8h As 2d', phase: 'discard' }), rules: rules({ ginBonus: 50 }) };
      expect(knock(h, 10).result).toMatchObject({ kind: 'gin', bonus: 50, points: 60 + 50 });
    });

    it('can be doubled for an undercut', () => {
      const h = { ...handOf({ player: '7h 7d 7c 2s 3s 4s 8s 9s Ts 3c Qd', bot: 'Ah Ac Ad 9d 9c 9h 5d 5c 5h 3d', phase: 'discard' }), rules: rules({ undercutBonus: 50 }) };
      expect(knock(h, 10).result).toMatchObject({ kind: 'undercut', bonus: 50, points: 50 });
    });

    it('do not change a plain knock', () => {
      const h = { ...handOf({ player: '7h 7d 7c 2s 3s 4s 8s 9s Ts 3c Qd', bot: 'Kd Qs Jc 9h 6d 5s 2c Ah 8d 4h', phase: 'discard' }), rules: rules({ ginBonus: 50, undercutBonus: 50 }) };
      expect(knock(h, 10).result).toMatchObject({ kind: 'knock', bonus: 0, points: 57 });
    });
  });

  describe('how long the match is', () => {
    const win = (m: ReturnType<typeof startMatch>, points: number) =>
      updateHand(m, { ...m.hand, phase: 'over', result: { kind: 'knock', winner: 'player', knocker: 'player', points, bonus: 0 } });

    it('ends at the chosen score', () => {
      expect(win(startMatch(deck, 10, 'bot', { rules: rules({ target: 50 }) }), 49).status).toBe('playing');
      expect(win(startMatch(deck, 10, 'bot', { rules: rules({ target: 50 }) }), 50).status).toBe('won');
      expect(win(startMatch(deck, 10, 'bot', { rules: rules({ target: 150 }) }), 120).status).toBe('playing');
      expect(win(startMatch(deck, 10, 'bot', { rules: rules({ target: 150 }) }), 150).status).toBe('won');
    });

    it('still ends a standard match at 100, not before', () => {
      expect(win(startMatch(deck, 10, 'bot'), 99).status).toBe('playing');
      expect(win(startMatch(deck, 10, 'bot'), 100).status).toBe('won');
    });
  });

  describe('what a win pays', () => {
    const won = (bet: number, difficulty: 'easy' | 'normal' | 'hard') => {
      const m = startMatch(deck, bet, 'bot', { difficulty });
      return updateHand(m, { ...m.hand, phase: 'over', result: { kind: 'knock', winner: 'player', knocker: 'player', points: 100, bonus: 0 } });
    };

    it('grows with the bot strength: 1.5x, 2x and 3x the bet', () => {
      expect(PAYOUT_BY_DIFFICULTY).toEqual({ easy: 1.5, normal: 2, hard: 3 });
      expect(returnedFor(won(100, 'easy'))).toBe(150);
      expect(returnedFor(won(100, 'normal'))).toBe(200);
      expect(returnedFor(won(100, 'hard'))).toBe(300);
    });

    it('rounds down to a whole coin', () => {
      expect(returnedFor(won(5, 'easy'))).toBe(7);
      expect(returnedFor(won(25, 'easy'))).toBe(37);
      expect(returnedFor(won(1, 'easy'))).toBe(1);
    });

    it('pays nothing for a loss or a forfeit, whatever the strength', () => {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) expect(returnedFor(forfeit(startMatch(deck, 50, 'bot', { difficulty })))).toBe(0);
    });

    it('is fixed when the match starts', () => {
      const m = startMatch(deck, 10, 'bot', { difficulty: 'hard' });
      expect(m.payout).toBe(3);
      expect(m.difficulty).toBe('hard');
    });
  });
});

// Throwing the Qd (index 10) leaves a set of 7s, the run 2-3-4 and a loose 9 (9 points).
const KNOCKER_FOR_LIMITS = '7h 7d 7c 2s 3s 4s 8s 9s Ts 9c Qd';
