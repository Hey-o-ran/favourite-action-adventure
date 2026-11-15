import { describe, expect, it } from 'vitest';
import {
  analyze,
  checkFollow,
  decompose,
  domainOf,
  legalFollow,
  makeDeck,
  pointsOf,
  trickWinner,
  type Analysis,
  type Play,
  type SCard,
  type Trump,
} from './shengjiCards';
import { HAND_SIZE, deal, kittyPointsOf, teamOf } from './shengjiScoring';
import { HEARTS_5, sc } from './shengjiTestUtils';

/** A fixed stream of numbers, so a failure can always be replayed. */
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

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const randomTrump = (random: () => number): Trump => ({
  level: 2 + Math.floor(random() * 13),
  suit: random() < 0.15 ? null : SUITS[Math.floor(random() * 4)],
});

/** Picks something legal for the leader to play: one piece of one suit (a single, a pair or a tractor). */
function randomLead(hand: readonly SCard[], t: Trump, random: () => number): SCard[] {
  const domains = [...new Set(hand.map((c) => domainOf(c, t)))];
  const domain = domains[Math.floor(random() * domains.length)];
  const pieces = decompose(hand.filter((c) => domainOf(c, t) === domain), t);
  return pieces[Math.floor(random() * pieces.length)].cards;
}

/** Plays a whole hand with everyone making a legal play, until the cards run out, and returns what each side won. */
function playHand(seed: number) {
  const random = seeded(seed);
  const t = randomTrump(random);
  const { hands: dealt, kitty } = deal(shuffled(makeDeck(), random), Math.floor(random() * 4));
  const hands = dealt.map((h) => [...h]);
  const won = [0, 0];
  let leader = Math.floor(random() * 4);
  let tricks = 0;

  for (let trick = 0; hands[leader].length > 0; trick++) {
    expect(new Set(hands.map((h) => h.length)).size, `seed ${seed}: every player holds the same number of cards`).toBe(1);
    const leadCards = randomLead(hands[leader], t, random);
    const lead: Analysis = analyze(leadCards, t);
    const plays: Play[] = [{ seat: leader, cards: leadCards }];
    for (let i = 1; i < 4; i++) {
      const seat = (leader + i) % 4;
      const cards = legalFollow(hands[seat], lead, t);
      expect(checkFollow(hands[seat], cards, lead, t), `seed ${seed}, trick ${trick}, seat ${seat}`).toBeNull();
      plays.push({ seat, cards });
    }
    for (const p of plays) {
      for (const c of p.cards) {
        const at = hands[p.seat].findIndex((h) => h.id === c.id);
        expect(at, `seed ${seed}: seat ${p.seat} played a card it did not have`).toBeGreaterThanOrEqual(0);
        hands[p.seat].splice(at, 1);
      }
    }
    const winner = trickWinner(plays, t);
    expect(plays.map((p) => p.seat)).toContain(winner);
    won[teamOf(winner)] += plays.flatMap((p) => p.cards).reduce((n, c) => n + pointsOf(c), 0);
    leader = winner;
    tricks++;
  }
  return { hands, kitty, won, tricks, t };
}

describe('playing whole hands with random legal plays', () => {
  it('always gets to the end: every card played, and every player always had a legal play', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { hands, tricks } = playHand(seed);
      expect(tricks, `seed ${seed}`).toBeGreaterThan(0);
      expect(tricks, `seed ${seed}`).toBeLessThanOrEqual(HAND_SIZE);
      expect(hands.map((h) => h.length), `seed ${seed}`).toEqual([0, 0, 0, 0]);
    }
  });

  it('hands out every point that was dealt: 200, less whatever is in the kitty', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { won, kitty } = playHand(seed);
      expect(won[0] + won[1], `seed ${seed}`).toBe(200 - kittyPointsOf(kitty));
    }
  });

  it('spreads the points between both sides', () => {
    let both = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { won } = playHand(seed);
      if (won[0] > 0 && won[1] > 0) both++;
    }
    expect(both).toBeGreaterThan(50);
  });
});

describe('legal follows', () => {
  const T = HEARTS_5;
  const lead = (text: string) => analyze(sc(text), T);

  it('gives the cheapest legal play, keeping points back', () => {
    // Following a spade lead with no spades: give away the cards worth nothing, not the 10 or the king.
    const hand = sc('Kd Td 3d 4c 9c');
    const play = legalFollow(hand, lead('As'), T);
    expect(play).toHaveLength(1);
    expect(pointsOf(play[0])).toBe(0);
  });

  it('plays all of a short suit and makes up the number with the cheapest other cards', () => {
    const hand = sc('3s Kd Td 4c 9c');
    const play = legalFollow(hand, lead('As As'), T);
    expect(play.map((c) => c.suit + c.rank).sort()).toContain('spades3');
    expect(play).toHaveLength(2);
    expect(checkFollow(hand, play, lead('As As'), T)).toBeNull();
  });

  it('plays the lowest pair when a pair is needed', () => {
    const hand = sc('9s 9s 7s 7s 3s');
    const play = legalFollow(hand, lead('As As'), T);
    expect(play.map((c) => c.rank)).toEqual([7, 7]);
  });

  it('plays the lowest tractor when a tractor is needed', () => {
    const hand = sc('9s 9s Ts Ts 7s 7s 8s 8s 2s');
    const play = legalFollow(hand, lead('Ks Ks As As'), T);
    expect(play.map((c) => c.rank).sort((a, b) => a - b)).toEqual([7, 7, 8, 8]);
  });

  it('is always legal, whatever the hand and the lead', () => {
    const random = seeded(42);
    for (let i = 0; i < 400; i++) {
      const t = randomTrump(random);
      const hand = shuffled(makeDeck(), random).slice(0, 5 + Math.floor(random() * 21));
      const other = shuffled(makeDeck(), random).slice(0, 25);
      const leadCards = randomLead(other, t, random);
      const analysis = analyze(leadCards, t);
      expect(checkFollow(hand, legalFollow(hand, analysis, t), analysis, t), `case ${i}`).toBeNull();
    }
  });
});

describe('breaking a hand into pieces', () => {
  it('uses every card exactly once, whatever the cards are', () => {
    const random = seeded(7);
    for (let i = 0; i < 300; i++) {
      const t = randomTrump(random);
      const hand = shuffled(makeDeck(), random).slice(0, 25);
      const domain = domainOf(hand[0], t);
      const group = hand.filter((c) => domainOf(c, t) === domain);
      const pieces = decompose(group, t);
      expect(pieces.flatMap((p) => p.cards).map((c) => c.id).sort((a, b) => a - b), `case ${i}`).toEqual(group.map((c) => c.id).sort((a, b) => a - b));
      for (const piece of pieces) expect(piece.cards).toHaveLength(piece.kind === 'single' ? 1 : piece.kind === 'pair' ? 2 : piece.length * 2);
    }
  });

  it('lists the biggest piece first', () => {
    const pieces = decompose(sc('Qs Qs Js Js 9s 9s 2s 3s'), HEARTS_5);
    const sizes = pieces.map((p) => p.cards.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    expect(pieces[0].kind).toBe('tractor');
  });
});
