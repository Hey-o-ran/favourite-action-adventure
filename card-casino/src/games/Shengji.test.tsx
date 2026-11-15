// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { shuffle } from '../cards';
import { WalletContext, type WalletValue } from '../wallet';
import { Shengji, BOT_DELAY_MS } from './Shengji';
import { analyze, checkFollow, makeDeck, type SCard } from './shengjiCards';
import { nextHand, type Standing } from './shengjiScoring';
import { botCards, payoutFor, playCards, startHand, type HandState } from './shengjiTable';

// The deck is whatever the test says, so every hand is known.
vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));

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
const deckFor = (seed: number) => shuffled(makeDeck(), seeded(seed));

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();
const wallet = (balance: number): WalletValue => ({
  balance,
  wager,
  settle,
  flush: async () => {},
  refresh: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});

/** Seat 0 is the player. Math.random decides the first declarer: 0 is you, 0.25 is the player on your left. */
function setup(deck: SCard[], declarerRandom = 0, balance = 1000) {
  vi.mocked(shuffle).mockReturnValue(deck as never);
  vi.spyOn(Math, 'random').mockReturnValue(declarerRandom);
  render(
    <WalletContext.Provider value={wallet(balance)}>
      <Shengji />
    </WalletContext.Provider>,
  );
}

const START: Standing = { levels: [2, 2], declarer: 0 };
const deal = () => fireEvent.click(screen.getByRole('button', { name: /^deal$/i }));
const handCards = () => [...document.querySelectorAll<HTMLElement>('.sj-hand .card')];
const cardEl = (id: number) => document.querySelector<HTMLElement>(`.sj-hand .card[data-id="${id}"]`)!;
const pass = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const result = () => document.querySelector('.result');
const playButton = () => screen.getByRole('button', { name: /^play \d|^choose cards/i });

/** Picks these cards and presses Play, like a player would. */
function playCardsOnScreen(cards: readonly SCard[]) {
  for (const c of cards) fireEvent.click(cardEl(c.id));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^play ${cards.length} card`, 'i') }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  wager.mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('dealing a hand', () => {
  it('takes the bet and shows your 25 cards, trumps first, with the trump and the declarer', () => {
    setup(deckFor(1));
    deal();
    expect(wager).toHaveBeenCalledWith(50);
    expect(handCards()).toHaveLength(25);
    expect(screen.getByText(/your hand · 25 cards/i)).toBeInTheDocument();
    expect(document.querySelector('.scoreboard')).toHaveTextContent(/your side is on level 2/i);
    expect(document.querySelector('.scoreboard')).toHaveTextContent(/trump, level 2|no trump suit, level 2/i);
    expect(document.querySelector('.scoreboard')).toHaveTextContent(/you are the declarer/i);
    expect(screen.getAllByRole('group').some((g) => g.getAttribute('aria-label') === 'Trumps')).toBe(true);
    expect(screen.getByText(/partner/i, { selector: '.sj-seat b' })).toBeInTheDocument();
  });

  it('shows the same hand as the rules engine dealt', () => {
    const deck = deckFor(3);
    setup(deck);
    deal();
    const expected = startHand(deck, START).hands[0].map((c) => c.id).sort((a, b) => a - b);
    expect(handCards().map((el) => Number(el.dataset.id)).sort((a, b) => a - b)).toEqual(expected);
  });

  it('shows each other player with their 25 cards, and whose turn it is', () => {
    setup(deckFor(1));
    deal();
    expect(screen.getAllByText('25 cards')).toHaveLength(3);
    expect(screen.getByText(/your lead/i)).toBeInTheDocument();
    expect(document.querySelector('.sj-seat.turn')).toBeNull(); // it is your turn, not a seat of the others
  });

  it('keeps the bet from changing during the hand', () => {
    setup(deckFor(1));
    deal();
    expect(screen.getByRole('spinbutton', { name: /bet/i })).toBeDisabled();
  });

  it('does not deal when you cannot afford the bet', () => {
    setup(deckFor(1), 0, 20);
    expect(screen.getByRole('button', { name: /^deal$/i })).toBeDisabled();
  });

  it('does not start if the bet cannot be taken', () => {
    wager.mockReturnValue(false);
    setup(deckFor(1));
    deal();
    expect(handCards()).toHaveLength(0);
  });
});

describe('choosing cards', () => {
  it('toggles a card as picked, and counts them on the Play button', () => {
    setup(deckFor(1));
    deal();
    const [a, b] = handCards();
    fireEvent.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Play 1 card' })).toBeEnabled();
    fireEvent.click(b);
    expect(screen.getByRole('button', { name: 'Play 2 cards' })).toBeEnabled();
    fireEvent.click(a);
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Play 1 card' })).toBeEnabled();
  });

  it('clears the choice', () => {
    setup(deckFor(1));
    deal();
    fireEvent.click(handCards()[0]);
    fireEvent.click(handCards()[1]);
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(handCards().every((el) => el.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(playButton()).toBeDisabled();
  });

  it('cannot play with nothing chosen', () => {
    setup(deckFor(1));
    deal();
    expect(screen.getByRole('button', { name: /choose cards to play/i })).toBeDisabled();
  });

  it('refuses a lead of cards from two suits, and says why', () => {
    setup(deckFor(1));
    deal();
    const groups = screen.getAllByRole('group').filter((g) => g.classList.contains('sj-group'));
    expect(groups.length).toBeGreaterThan(1);
    fireEvent.click(within(groups[0]).getAllByRole('button')[0]);
    fireEvent.click(within(groups[1]).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Play 2 cards' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/one suit/i);
    expect(handCards()).toHaveLength(25); // nothing was played
  });

  it('lets nobody pick cards while the bots are playing', () => {
    // The player on your left declares and leads, so it is not your turn yet.
    setup(deckFor(1), 0.25);
    deal();
    expect(handCards().every((el) => el.getAttribute('role') === 'img')).toBe(true);
    expect(result()).toHaveTextContent(/waiting for the left opponent/i);
    expect(screen.queryByRole('button', { name: /choose cards|play \d/i })).not.toBeInTheDocument();
  });
});

describe('playing a trick', () => {
  it('plays your lead, then each bot in turn a moment apart, and then the winner leads', () => {
    const deck = deckFor(2);
    setup(deck);
    deal();
    // Mirror it in the engine.
    let engine: HandState = startHand(deck, START);
    const lead = botCards(engine);
    playCardsOnScreen(lead);
    engine = (playCards(engine, 0, lead) as { state: HandState }).state;

    expect(handCards()).toHaveLength(24);
    expect(document.querySelectorAll('.sj-center .card')).toHaveLength(lead.length);
    expect(result()).toHaveTextContent(/waiting for the left opponent/i);

    for (const _ of [1, 2, 3]) {
      pass(BOT_DELAY_MS);
      engine = (playCards(engine, engine.turn, botCards(engine)) as { state: HandState }).state;
    }
    expect(engine.tricksPlayed).toBe(1);
    expect(handCards()).toHaveLength(24);
    expect(document.querySelector('.sj-last')).toHaveTextContent(/last trick won by/i);
    expect(document.querySelector('.sj-points')).toHaveTextContent(`The attackers have ${engine.attackerPoints} points`);
    expect(document.querySelector('.sj-points')).toHaveTextContent('1 tricks played');
  });

  it('is not started by a bot before its moment is up', () => {
    const deck = deckFor(2);
    setup(deck);
    deal();
    playCardsOnScreen(botCards(startHand(deck, START)));
    pass(BOT_DELAY_MS - 100);
    expect(document.querySelectorAll('.sj-center .card').length).toBeLessThanOrEqual(botCards(startHand(deck, START)).length);
    pass(100);
    expect(document.querySelectorAll('.sj-center .card').length).toBeGreaterThan(botCards(startHand(deck, START)).length - 1);
  });

  it('makes you follow suit, saying so when you do not', () => {
    // Find a deal where, after the bots have played, you hold the suit that was led and also some other card.
    let found: { deck: SCard[]; illegal: SCard } | null = null;
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const deck = deckFor(seed);
      let engine = startHand(deck, { levels: [2, 2], declarer: 1 });
      for (let i = 0; i < 3; i++) engine = (playCards(engine, engine.turn, botCards(engine)) as { state: HandState }).state;
      const lead = analyze(engine.trick[0].cards, engine.trump);
      const illegal = engine.hands[0].find((c) => checkFollow(engine.hands[0], [c], lead, engine.trump) !== null && lead.combos.length === 1 && lead.combos[0].kind === 'single');
      if (illegal) found = { deck, illegal };
    }
    expect(found).not.toBeNull();
    setup(found!.deck, 0.25);
    deal();
    for (let i = 0; i < 3; i++) pass(BOT_DELAY_MS); // each bot starts its wait only after the one before has played
    expect(result()).toHaveTextContent(/your turn/i);
    fireEvent.click(cardEl(found!.illegal.id));
    fireEvent.click(screen.getByRole('button', { name: 'Play 1 card' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/follow|all your cards/i);
    expect(handCards()).toHaveLength(25);
  });
});

describe('a whole hand', () => {
  /** Plays the hand to the end through the screen, with the engine playing alongside to know what should happen. */
  function playItOut(deck: SCard[], standing: Standing) {
    let engine = startHand(deck, standing);
    for (let guard = 0; engine.phase === 'playing' && guard < 400; guard++) {
      if (engine.turn === 0) {
        const cards = botCards(engine);
        playCardsOnScreen(cards);
        engine = (playCards(engine, 0, cards) as { state: HandState }).state;
      } else {
        pass(BOT_DELAY_MS);
        engine = (playCards(engine, engine.turn, botCards(engine)) as { state: HandState }).state;
      }
    }
    return engine;
  }

  it('ends with the same result on the screen as in the rules engine, and pays by it', () => {
    for (const seed of [4, 9]) {
      cleanup();
      vi.resetAllMocks();
      wager.mockReturnValue(true);
      const deck = deckFor(seed);
      setup(deck);
      deal();
      const engine = playItOut(deck, START);

      expect(engine.phase).toBe('over');
      expect(handCards()).toHaveLength(0);
      expect(result()).toHaveTextContent(`The attackers scored ${engine.result!.attackerScore}`);
      expect(settle).toHaveBeenCalledTimes(1);
      expect(settle).toHaveBeenCalledWith(50 * payoutFor(engine.result!));
    }
  });

  it('says what the hand was worth, and the coins won or lost', () => {
    const deck = deckFor(4);
    setup(deck);
    deal();
    const engine = playItOut(deck, START);
    const paid = payoutFor(engine.result!);
    if (paid > 0) expect(result()).toHaveTextContent(`+${50 * paid - 50} coins`);
    else expect(result()).toHaveTextContent('-50 coins');
  });

  it('moves on to the next hand at the levels the rules give, and takes a new bet', () => {
    const deck = deckFor(5);
    setup(deck);
    deal();
    const engine = playItOut(deck, START);
    const next = nextHand(START, engine.result!.outcome);

    fireEvent.click(screen.getByRole('button', { name: /^next hand$/i }));
    expect(wager).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.scoreboard')).toHaveTextContent(`level ${next.levels[0] === 14 ? 'A' : next.levels[0]}`);
    expect(handCards()).toHaveLength(25);
    expect(settle).toHaveBeenCalledTimes(1); // only the first hand has been paid so far
  });

  it('pays only once however many times the screen redraws', () => {
    const deck = deckFor(6);
    setup(deck);
    deal();
    playItOut(deck, START);
    pass(5000);
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
