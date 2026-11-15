import { describe, expect, it } from 'vitest';
import { isTrump, makeDeck, pointsOf, type SCard } from './shengjiCards';
import { attackingTeam, botCards, payoutFor, playCards, startHand, type HandState } from './shengjiTable';
import { teamOf, type Standing } from './shengjiScoring';
import { HEARTS_5, sc } from './shengjiTestUtils';

function seeded(seed: number) {
  let state = seed;
  return () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STANDING: Standing = { levels: [5, 8], declarer: 0 };
const freshHand = (seed = 1, standing = STANDING) => startHand(shuffled(makeDeck(), seeded(seed)), standing);

/** A table set up by hand, so a test can play exactly the cards it wants. */
function table(over: Partial<HandState> & { hands: SCard[][] }): HandState {
  return {
    standing: STANDING,
    trump: HEARTS_5,
    declarer: 0,
    kitty: [],
    turn: 0,
    trick: [],
    played: [],
    lastTrick: null,
    attackerPoints: 0,
    defenderPoints: 0,
    tricksPlayed: 0,
    phase: 'playing',
    result: null,
    log: '',
    ...over,
  };
}

describe('starting a hand', () => {
  it('gives every player 25 cards after the declarer buries 8, using each card once', () => {
    const h = freshHand();
    expect(h.hands.map((x) => x.length)).toEqual([25, 25, 25, 25]);
    expect(h.kitty).toHaveLength(8);
    const ids = [...h.hands.flat(), ...h.kitty].map((c) => c.id);
    expect(new Set(ids).size).toBe(108);
  });

  it('plays at the level of the declaring side, and the declarer leads', () => {
    expect(freshHand(1, { levels: [5, 8], declarer: 0 }).trump.level).toBe(5);
    expect(freshHand(1, { levels: [5, 8], declarer: 1 }).trump.level).toBe(8);
    expect(freshHand(1, { levels: [5, 8], declarer: 3 }).trump.level).toBe(8);
    const h = freshHand(1, { levels: [5, 8], declarer: 3 });
    expect(h.turn).toBe(3);
    expect(h.declarer).toBe(3);
  });

  it('buries cards that are not trump and not worth points when it can', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const h = freshHand(seed);
      const buriedPoints = h.kitty.reduce((n, c) => n + pointsOf(c), 0);
      const trumps = h.kitty.filter((c) => isTrump(c, h.trump)).length;
      expect(buriedPoints, `seed ${seed}`).toBeLessThanOrEqual(10);
      expect(trumps, `seed ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('starts with nothing played and no points won', () => {
    const h = freshHand();
    expect(h).toMatchObject({ phase: 'playing', trick: [], lastTrick: null, attackerPoints: 0, defenderPoints: 0, tricksPlayed: 0, result: null });
  });

  it('names the attackers as the side that is not declaring', () => {
    expect(attackingTeam({ declarer: 0 })).toBe(1);
    expect(attackingTeam({ declarer: 2 })).toBe(1);
    expect(attackingTeam({ declarer: 1 })).toBe(0);
    expect(attackingTeam({ declarer: 3 })).toBe(0);
  });
});

describe('making a play', () => {
  const hands = () => [sc('As 3s 4d'), sc('Ks 9s 2c'), sc('Qs 8s 2d'), sc('Js 7s 3c')];

  it('only on your turn', () => {
    const s = table({ hands: hands(), turn: 0 });
    const out = playCards(s, 1, [s.hands[1][0]]);
    expect(out).toEqual({ ok: false, error: 'It is not your turn' });
  });

  it('only with cards you hold', () => {
    const s = table({ hands: hands() });
    expect(playCards(s, 0, sc('9d'))).toMatchObject({ ok: false, error: expect.stringMatching(/not in the hand/) });
    expect(playCards(s, 0, [])).toMatchObject({ ok: false });
  });

  it('refuses a lead of cards from two suits', () => {
    const s = table({ hands: [sc('As 3s 4d 6c'), ...hands().slice(1)] });
    expect(playCards(s, 0, [s.hands[0][0], s.hands[0][2]])).toMatchObject({ ok: false, error: expect.stringMatching(/one suit/) });
  });

  it('passes the turn round the table clockwise as cards are played', () => {
    let s = table({ hands: hands() });
    const out = playCards(s, 0, [s.hands[0][0]]);
    expect(out.ok && out.state.turn).toBe(1);
    expect(out.ok && out.state.trick).toHaveLength(1);
    expect(out.ok && out.state.hands[0]).toHaveLength(2);
    s = (out as { state: HandState }).state;
    const next = playCards(s, 1, [s.hands[1][0]]);
    expect(next.ok && next.state.turn).toBe(2);
  });

  it('makes you follow suit, saying why when you do not', () => {
    let s = table({ hands: hands() });
    s = (playCards(s, 0, [s.hands[0][0]]) as { state: HandState }).state; // the ace of spades
    const bad = playCards(s, 1, [s.hands[1][2]]); // the 2 of clubs, with spades in hand
    expect(bad).toMatchObject({ ok: false, error: expect.stringMatching(/follow/) });
    expect(playCards(s, 1, [s.hands[1][1]])).toMatchObject({ ok: true });
  });

  it('is over once the cards run out, and refuses further plays', () => {
    const s = table({ hands: [sc('As'), sc('Ks'), sc('Qs'), sc('Js')], kitty: sc('2d 2d 3d 3d 4d 4d 6d 6d') });
    const done = playAll(s, ['As', 'Ks', 'Qs', 'Js']);
    expect(done.phase).toBe('over');
    expect(playCards(done, 0, sc('As'))).toEqual({ ok: false, error: 'The hand is over' });
  });
});

/** Plays one card each, in turn, from `texts`. */
function playAll(state: HandState, texts: string[]): HandState {
  let s = state;
  for (const text of texts) {
    const seat = s.turn;
    const want = sc(text)[0];
    const card = s.hands[seat].find((c) => c.rank === want.rank && c.suit === want.suit)!;
    const out = playCards(s, seat, [card]);
    if (!out.ok) throw new Error(out.error);
    s = out.state;
  }
  return s;
}

describe('a trick', () => {
  it('is won by the highest card, who then leads the next trick', () => {
    const s = table({ hands: [sc('As 3d'), sc('Ks 4d'), sc('Qs 5d'), sc('Js 6d')] });
    const after = playAll(s, ['As', 'Ks', 'Qs', 'Js']);
    expect(after.turn).toBe(0);
    expect(after.trick).toEqual([]);
    expect(after.lastTrick?.winner).toBe(0);
    expect(after.tricksPlayed).toBe(1);
    expect(after.lastTrick?.plays.map((p) => p.seat)).toEqual([0, 1, 2, 3]);
  });

  it('can be won by a trump on a plain suit', () => {
    const s = table({ hands: [sc('As 3d'), sc('3h 4d'), sc('Qs 5d'), sc('Js 6d')] });
    const after = playAll(s, ['As', '3h', 'Qs', 'Js']);
    expect(after.lastTrick?.winner).toBe(1);
    expect(after.turn).toBe(1);
  });

  it('gives its points to the side that won it: the attackers or the defenders', () => {
    // Seat 0 declares, so seats 0 and 2 defend and 1 and 3 attack.
    const toDefenders = playAll(table({ hands: [sc('As 3d'), sc('Ts 4d'), sc('Qs 8d'), sc('Ks 6d')], declarer: 0 }), ['As', 'Ts', 'Qs', 'Ks']);
    expect(toDefenders).toMatchObject({ defenderPoints: 20, attackerPoints: 0 });
    const toAttackers = playAll(table({ hands: [sc('3s 3d'), sc('As 4d'), sc('Ts 8d'), sc('Ks 6d')], declarer: 0 }), ['3s', 'As', 'Ts', 'Ks']);
    expect(toAttackers).toMatchObject({ attackerPoints: 20, defenderPoints: 0 });
  });

  it('counts points from every card in the trick, such as a pair of kings', () => {
    const s = table({ hands: [sc('As As'), sc('Ks Ks'), sc('9s 9s'), sc('Ts Ts')], declarer: 0 });
    const pair = (seat: number, state: HandState) => playCards(state, seat, state.hands[seat]);
    let st = s;
    for (const seat of [0, 1, 2, 3]) st = (pair(seat, st) as { state: HandState }).state;
    expect(st.defenderPoints).toBe(40); // two kings and two tens went to seat 0 with the aces
    expect(st.phase).toBe('over');
  });
});

describe('throws', () => {
  it('stand when nobody can beat any part', () => {
    const s = table({ hands: [sc('As Ks Ks'), sc('Qs Js 3d'), sc('9s 8s 3c'), sc('7s 6s 2c')] });
    const out = playCards(s, 0, s.hands[0]);
    expect(out).toMatchObject({ ok: true });
    expect(out.ok && out.state.trick[0].cards).toHaveLength(3);
    expect(out.ok && out.state.log).toBe('');
  });

  it('only play the weakest part when an opponent can beat one, and say so', () => {
    const s = table({ hands: [sc('Ks 9s 3d'), sc('As 3c 4c'), sc('Qs 5c 6c'), sc('Js 7c 8c')] });
    const out = playCards(s, 0, sc('Ks 9s').map((w) => s.hands[0].find((c) => c.rank === w.rank && c.suit === w.suit)!));
    expect(out).toMatchObject({ ok: true });
    if (out.ok) {
      expect(out.state.trick[0].cards.map((c) => c.rank)).toEqual([9]);
      expect(out.state.log).toMatch(/weakest/);
      expect(out.state.hands[0].map((c) => c.rank).sort((a, b) => a - b)).toEqual([3, 13]); // the king is still in the hand
    }
  });

  it('are not beaten by the partner, only by the opponents', () => {
    // Seat 2 is the partner and holds the ace. Seats 1 and 3, the opponents, hold nothing higher than the king or queen.
    const s = table({ hands: [sc('Ks Qs'), sc('Js 3c'), sc('As 4c'), sc('9s 7c')] });
    const out = playCards(s, 0, s.hands[0]);
    expect(out.ok && out.state.trick[0].cards).toHaveLength(2);
  });
});

describe('the end of a hand', () => {
  // Seat 0 declares (so seats 1 and 3 attack), the kitty holds 25 points, and each player has one card left.
  const kitty = sc('5s 5d 5c Kd Kc 2d 3d 4d'); // 5+5+5+10+10 = 35 points
  it('gives the kitty to the attackers, doubled, when they win the last trick with a single', () => {
    const s = table({ hands: [sc('Ks'), sc('As'), sc('Qs'), sc('Js')], kitty, attackerPoints: 40, tricksPlayed: 24 });
    const done = playAll(s, ['Ks', 'As', 'Qs', 'Js']);
    expect(done.phase).toBe('over');
    expect(done.result).toMatchObject({ kittyPoints: 35, kittyBonus: 70, attackerScore: 40 + 70 + 10 });
    // The last trick held a king, and the attackers took it, so its 10 points count too.
  });

  it('quadruples the kitty when the attackers win the last trick with a pair', () => {
    const s = table({ hands: [sc('3s 3s'), sc('As As'), sc('4s 4s'), sc('6s 6s')], kitty, attackerPoints: 0 });
    let st = s;
    for (const seat of [0, 1, 2, 3]) st = (playCards(st, seat, st.hands[seat]) as { state: HandState }).state;
    expect(st.result).toMatchObject({ kittyBonus: 35 * 4, attackerScore: 140 });
  });

  it('gives the attackers nothing from the kitty when the defenders win the last trick', () => {
    const s = table({ hands: [sc('As'), sc('Ks'), sc('Qs'), sc('Js')], kitty, attackerPoints: 60 });
    const done = playAll(s, ['As', 'Ks', 'Qs', 'Js']);
    expect(done.result).toMatchObject({ kittyBonus: 0, attackerScore: 60 });
    expect(done.result?.outcome).toEqual({ winner: 'defenders', levels: 1 });
    expect(done.result?.winningTeam).toBe(0);
  });

  it('is a win for the attackers from 80, with the levels for how many points they got', () => {
    const s = table({ hands: [sc('3s'), sc('As'), sc('4s'), sc('6s')], kitty: sc('2d 2d 3d 3d 4d 4d 6d 6d'), attackerPoints: 130 });
    const done = playAll(s, ['3s', 'As', '4s', '6s']);
    expect(done.result?.attackerScore).toBe(130);
    expect(done.result?.outcome).toEqual({ winner: 'attackers', levels: 1 });
    expect(done.result?.winningTeam).toBe(1);
  });

  it('is a big win for the defenders when the attackers get nothing', () => {
    const s = table({ hands: [sc('As'), sc('2s'), sc('3s'), sc('4s')], kitty: sc('2d 2d 3d 3d 4d 4d 6d 6d'), attackerPoints: 0 });
    const done = playAll(s, ['As', '2s', '3s', '4s']);
    expect(done.result?.outcome).toEqual({ winner: 'defenders', levels: 3 });
  });

  it('pays the player by their side: 2x, 3x or 4x for a win, nothing for a loss', () => {
    const result = (winningTeam: 0 | 1, levels: number) => ({ attackerScore: 0, kittyPoints: 0, kittyBonus: 0, outcome: { winner: 'defenders' as const, levels }, winningTeam });
    expect(payoutFor(result(0, 1))).toBe(2);
    expect(payoutFor(result(0, 0))).toBe(2);
    expect(payoutFor(result(0, 2))).toBe(3);
    expect(payoutFor(result(0, 3))).toBe(4);
    expect(payoutFor(result(1, 3))).toBe(0);
    expect(teamOf(0)).toBe(0);
  });
});

describe('the bots', () => {
  it('lead their cheapest plain card, and trump only if that is all they have', () => {
    const s = table({ hands: [sc('Ks 5d 3h 4s'), [], [], []], turn: 0 });
    // The 5 of diamonds is trump (the level), the 3 of hearts is trump, so the cheapest plain card is the 4 of spades.
    expect(botCards(s).map((c) => c.rank)).toEqual([4]);
    const onlyTrump = table({ hands: [sc('5d 3h 2h'), [], [], []], turn: 0 });
    expect(botCards(onlyTrump).map((c) => c.rank)).toEqual([2]);
  });

  it('follow with a legal play, giving away the cheapest cards', () => {
    let s = table({ hands: [sc('As 3d'), sc('Ks Ts 9s 4d'), sc('Qs 8s'), sc('Js 7s')] });
    s = (playCards(s, 0, [s.hands[0][0]]) as { state: HandState }).state;
    const cards = botCards(s);
    expect(cards).toHaveLength(1);
    expect(cards[0].suit).toBe('spades');
    expect(pointsOf(cards[0])).toBe(0); // a 9, not the king or the ten
  });

  it('play whole hands to the end, however the cards fall', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const random = seeded(seed);
      const standing: Standing = { levels: [2 + Math.floor(random() * 13), 2 + Math.floor(random() * 13)], declarer: Math.floor(random() * 4) };
      let s = startHand(shuffled(makeDeck(), random), standing);
      for (let guard = 0; s.phase === 'playing' && guard < 200; guard++) {
        const out = playCards(s, s.turn, botCards(s));
        expect(out.ok, `seed ${seed}: ${!out.ok && out.error}`).toBe(true);
        if (!out.ok) break;
        s = out.state;
      }
      expect(s.phase, `seed ${seed}`).toBe('over');
      expect(s.hands.flat(), `seed ${seed}`).toHaveLength(0);
      // Every point is somewhere: won in tricks by one side, or in the kitty.
      const kitty = s.kitty.reduce((n, c) => n + pointsOf(c), 0);
      expect(s.attackerPoints + s.defenderPoints + kitty, `seed ${seed}`).toBe(200);
      expect(s.result).not.toBeNull();
    }
  });
});
