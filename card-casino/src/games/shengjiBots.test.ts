import { describe, expect, it } from 'vitest';
import { makeDeck, pointsOf, type SCard } from './shengjiCards';
import { botCards } from './shengjiBots';
import { playCards, startHand, type HandState } from './shengjiTable';
import { teamOf, type Standing } from './shengjiScoring';
import { HEARTS_5, sc } from './shengjiTestUtils';

const STANDING: Standing = { levels: [5, 8], declarer: 0 };

function table(over: Partial<HandState> & { hands: SCard[][] }): HandState {
  return {
    standing: STANDING, trump: HEARTS_5, declarer: 0, kitty: [], turn: 0, trick: [], played: [], lastTrick: null,
    attackerPoints: 0, defenderPoints: 0, tricksPlayed: 0, phase: 'playing', result: null, log: '', ...over,
  };
}
const names = (cards: SCard[]) => cards.map((c) => `${c.rank}${c.suit[0]}`);

describe('Shengji bots leading', () => {
  it('lead an ace that nobody can beat, rather than a low card', () => {
    const s = table({ hands: [sc('As 4s 3d'), [], [], []] });
    expect(names(botCards(s))).toEqual(['14s']);
  });

  it('lead a pair that nobody can beat before a single ace', () => {
    const s = table({ hands: [sc('As Kd Kd 4s'), [], [], []] });
    // Both aces of diamonds are still out, so the kings could be beaten. The single ace of spades can be beaten only by the other ace: equal does not beat.
    expect(names(botCards(s))).toEqual(['14s']);
    const pair = table({ hands: [sc('Ad Ad 4s 3c'), [], [], []] });
    expect(names(botCards(pair))).toEqual(['14d', '14d']);
  });

  it('lead the cheapest plain card when nothing is safe, keeping points back', () => {
    const s = table({ hands: [sc('Ks Ts 4s 3h'), [], [], []] });
    expect(names(botCards(s))).toEqual(['4s']);
  });

  it('lead a card that is safe because the cards above it have been played', () => {
    const s = table({ hands: [sc('Ks 4s 3d'), [], [], []], played: sc('As As') });
    expect(names(botCards(s))).toEqual(['13s']);
  });
});

describe('Shengji bots following', () => {
  it('feed points to a partner who is winning, when they play last', () => {
    // Seat 2 (partner of seat 0) leads the ace of spades and wins; seat 3 follows low; seat 0 plays last.
    const s = table({
      hands: [sc('Ks 5s 4s 2d'), sc('9s'), sc(''), sc('')],
      trick: [{ seat: 2, cards: sc('As') }, { seat: 3, cards: sc('3s') }, { seat: 1, cards: sc('2s') }],
      turn: 0,
    });
    expect(names(botCards(s))).toEqual(['13s']);
  });

  it('take a trick with points on it using the cheapest card that wins', () => {
    const s = table({
      hands: [sc(''), sc('As Qs 4s 3d'), sc(''), sc('')],
      trick: [{ seat: 0, cards: sc('Ts') }],
      turn: 1,
    });
    // The queen already beats the ten, so the ace stays in hand.
    expect(names(botCards(s))).toEqual(['12s']);
  });

  it('give away a cheap card rather than spend a trump on an empty trick', () => {
    const s = table({
      hands: [sc(''), sc('Ah 4d 9c'), sc(''), sc('')],
      trick: [{ seat: 0, cards: sc('9s') }],
      turn: 1,
    });
    expect(names(botCards(s))).toEqual(['4d']);
  });

  it('ruff a trick with points on it when void in the suit', () => {
    const s = table({
      hands: [sc(''), sc('3h 2h 4d'), sc(''), sc('')],
      trick: [{ seat: 0, cards: sc('Ks') }],
      turn: 1,
    });
    expect(names(botCards(s))).toEqual(['2h']);
  });
});

describe('Shengji bots over whole hands', () => {
  function seeded(seed: number) {
    let state = seed;
    return () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296);
  }
  const shuffled = <T,>(items: readonly T[], random: () => number): T[] => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  it('always make legal plays, and a side that plays this way does well against cheap play', () => {
    let wins = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const random = seeded(seed);
      let s = startHand(shuffled(makeDeck(), random), { levels: [2 + Math.floor(random() * 13), 2 + Math.floor(random() * 13)], declarer: seed % 4 });
      for (let guard = 0; s.phase === 'playing' && guard < 200; guard++) {
        const out = playCards(s, s.turn, botCards(s));
        expect(out.ok, `seed ${seed}: ${!out.ok && out.error}`).toBe(true);
        if (!out.ok) break;
        s = out.state;
      }
      expect(s.phase, `seed ${seed}`).toBe('over');
      const kitty = s.kitty.reduce((n, c) => n + pointsOf(c), 0);
      expect(s.attackerPoints + s.defenderPoints + kitty, `seed ${seed}`).toBe(200);
      if (s.result && s.result.winningTeam === teamOf(s.declarer)) wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});
