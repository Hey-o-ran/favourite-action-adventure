// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducer } from 'react';
import { act as reactAct, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { shuffle } from '../cards';
import { WalletContext, type WalletValue } from '../wallet';
import { LanguageProvider, STORAGE_KEY } from '../i18n';
import { DEAL_LOCK_MS } from '../useDealLock';
import { Landlord } from './Landlord';
import { newLandlordDeck, type LCard } from './landlordRules';
import { cards } from './landlordTestUtils';

// The deck is whatever the test says, so every hand is known.
vi.mock('../cards', async (orig) => ({ ...(await orig<typeof import('../cards')>()), shuffle: vi.fn() }));

/** A deck where seat 0 (you) is dealt the cards in `mine`: every third card goes to you. */
function deckFor(mine: string): LCard[] {
  const all = newLandlordDeck();
  const want = cards(mine);
  const key = (c: { rank: number; suit?: string }) => `${c.rank}${c.suit ?? ''}`;
  const wanted = new Set(want.map(key));
  const yours = all.filter((c) => wanted.has(key(c)));
  const others = all.filter((c) => !wanted.has(key(c)));
  const deck: LCard[] = [];
  let m = 0;
  let o = 0;
  for (let i = 0; i < 54; i++) deck.push(i % 3 === 0 && m < yours.length ? yours[m++] : others[o++]);
  return deck;
}
/** The rocket, bombs and 2s: worth a bid of 3. */
const STRONG = deckFor('X x 2s 2h 2d 2c As Ah Ad Ac Ks Kh Kd Kc 5s 3s 4s');

const wager = vi.fn<(amount: number) => boolean>();
const settle = vi.fn<(returned: number) => void>();
let balance = 1000;
const wallet = (): WalletValue => ({
  balance,
  wager,
  settle,
  flush: async () => {},
  refresh: async () => {},
  status: 'saved',
  dismissNotice: vi.fn(),
});

/** Like the real wallet: the balance changes when the game wagers or settles, and the game is shown the new balance. */
let refresh = () => {};
function Harness() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  refresh = force;
  return (
    <LanguageProvider>
      <WalletContext.Provider value={wallet()}>
        <Landlord />
      </WalletContext.Provider>
    </LanguageProvider>
  );
}

const setup = (deck: LCard[] = STRONG) => {
  vi.mocked(shuffle).mockReturnValue(deck);
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(<Harness />);
  return user;
};

const button = (name: RegExp | string) => screen.getByRole('button', { name });
const queryButton = (name: RegExp | string) => screen.queryByRole('button', { name });
const advance = (ms: number) => reactAct(() => vi.advanceTimersByTime(ms));
const handArea = () => screen.getByRole('group', { name: /your hand/i });
const myCards = () => within(handArea()).getAllByRole('button', { name: /of|joker/i });

/** Deals and bids 3, so you are the landlord. */
async function becomeLandlord() {
  const user = setup();
  await user.click(button(/^deal$/i));
  await advance(DEAL_LOCK_MS);
  await user.click(button(/^bid 3$/i));
  return user;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0); // you bid first
  balance = 1000;
  wager.mockImplementation((amount) => {
    if (amount > balance) return false;
    balance -= amount;
    refresh();
    return true;
  });
  settle.mockImplementation((returned) => {
    balance += returned;
    refresh();
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('before the deal', () => {
  it('shows the bet and a Deal button, and no cards', () => {
    setup();
    expect(button(/^deal$/i)).toBeEnabled();
    expect(screen.getByLabelText(/^bet/i)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /your hand/i })).not.toBeInTheDocument();
  });

  it('cannot deal when the bet is more than you have', async () => {
    balance = 5;
    setup();
    expect(button(/^deal$/i)).toBeDisabled();
  });
});

describe('the deal and the bidding', () => {
  it('takes the bet and deals you 17 cards, sorted with the highest first', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(wager).toHaveBeenCalledWith(10);
    expect(myCards()).toHaveLength(17);
    const labels = myCards().map((c) => c.getAttribute('aria-label') ?? '');
    expect(labels[0]).toMatch(/big joker/i);
    expect(labels[1]).toMatch(/small joker/i);
  });

  it('asks for your bid, with only the bids you are allowed to make', async () => {
    const user = setup();
    await user.click(button(/^deal$/i));
    expect(button(/^pass$/i)).toBeInTheDocument();
    expect(button(/^bid 1$/i)).toBeInTheDocument();
    expect(button(/^bid 2$/i)).toBeInTheDocument();
    expect(button(/^bid 3$/i)).toBeInTheDocument();
  });

  it('makes you the landlord when you bid 3, and shows the three extra cards', async () => {
    await becomeLandlord();
    expect(myCards()).toHaveLength(20);
    expect(screen.getByText(/you are the landlord/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /landlord's three cards/i })).toBeInTheDocument();
    expect(screen.getByText(/multiplier ×3/i)).toBeInTheDocument();
  });

  it('shows how many cards each bot holds', async () => {
    await becomeLandlord();
    expect(screen.getAllByText(/17 cards/)).toHaveLength(2);
  });
});

describe('playing your cards', () => {
  it('selects a card when you click it, and unselects it when you click it again', async () => {
    const user = await becomeLandlord();
    const lowest = myCards()[myCards().length - 1];
    await user.click(lowest);
    expect(lowest).toHaveAttribute('aria-pressed', 'true');
    await user.click(lowest);
    expect(lowest).toHaveAttribute('aria-pressed', 'false');
  });

  it('only lets you play a selection that is a legal play', async () => {
    const user = await becomeLandlord();
    const [a, b] = [myCards()[myCards().length - 1], myCards()[0]];
    await user.click(a);
    expect(button(/^play$/i)).toBeEnabled();
    await user.click(b);
    expect(button(/^play$/i)).toBeDisabled();
  });

  it('plays the selected card, takes it from your hand, and shows what you played', async () => {
    const user = await becomeLandlord();
    const lowest = myCards()[myCards().length - 1];
    await user.click(lowest);
    await user.click(button(/^play$/i));
    expect(myCards()).toHaveLength(19);
    expect(screen.getByRole('region', { name: /last play/i })).toHaveTextContent(/you/i);
  });

  it('does not let you pass when you are leading', async () => {
    await becomeLandlord();
    expect(button(/^pass$/i)).toBeDisabled();
  });

  it('lets the bots take their turns, and then asks for yours again', async () => {
    const user = await becomeLandlord();
    await user.click(myCards()[myCards().length - 1]);
    await user.click(button(/^play$/i));
    await advance(1000);
    await advance(1000);
    expect(screen.getByRole('status')).toHaveTextContent(/your turn|you lead/i);
  });

  it('suggests a play with Hint by selecting the cards', async () => {
    const user = await becomeLandlord();
    await user.click(button(/^hint$/i));
    const selected = myCards().filter((c) => c.getAttribute('aria-pressed') === 'true');
    expect(selected.length).toBeGreaterThan(0);
    expect(button(/^play$/i)).toBeEnabled();
  });
});

describe('grouping cards', () => {
  it('groups the selected cards, labels the group when it is a play, and selects it as one', async () => {
    const user = await becomeLandlord();
    const hand = () => myCards();
    // The two lowest cards of the hand are the 3 and 4 of spades: not a play together.
    await user.click(hand()[hand().length - 1]);
    await user.click(hand()[hand().length - 2]);
    await user.click(button(/^group$/i));
    expect(screen.getAllByRole('group', { name: /^group/i })).toHaveLength(1);
    // Click the group to select it as one, then take it apart.
    await user.click(within(screen.getByRole('group', { name: /^group/i })).getAllByRole('button')[0]);
    await user.click(button(/^ungroup$/i));
    expect(screen.queryByRole('group', { name: /^group/i })).not.toBeInTheDocument();
  });

  it('puts a group first and selects the whole group when one of its cards is clicked', async () => {
    const user = await becomeLandlord();
    const sorted = myCards();
    // Group the two lowest cards, then click one of them: both become selected.
    await user.click(sorted[sorted.length - 1]);
    await user.click(sorted[sorted.length - 2]);
    await user.click(button(/^group$/i));
    const first = within(screen.getByRole('group', { name: /^group/i })).getAllByRole('button');
    await user.click(first[0]);
    expect(within(screen.getByRole('group', { name: /^group/i })).getAllByRole('button').every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('names a group that is a legal play', async () => {
    const user = await becomeLandlord();
    // The four 2s are in your hand: select them and group them.
    const twos = myCards().filter((c) => /^2 of/.test(c.getAttribute('aria-label') ?? ''));
    expect(twos).toHaveLength(4);
    for (const c of twos) await user.click(c);
    await user.click(button(/^group$/i));
    expect(screen.getByRole('group', { name: /group.*bomb/i })).toBeInTheDocument();
  });
});

describe('giving up', () => {
  it('asks first, and only then ends the round as a loss, taking the extra part from your balance', async () => {
    const user = await becomeLandlord();
    await user.click(button(/^give up$/i));
    expect(wager).toHaveBeenCalledTimes(1); // only the bet so far
    await user.click(button(/^yes, give up$/i));
    // Landlord at ×3 with a bet of 10: a quarter of 30 is 7.
    expect(wager).toHaveBeenLastCalledWith(7);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith(0);
    expect(screen.getByText(/you lose/i)).toBeInTheDocument();
  });

  it('keeps playing if you change your mind', async () => {
    const user = await becomeLandlord();
    await user.click(button(/^give up$/i));
    await user.click(button(/keep playing/i));
    expect(settle).not.toHaveBeenCalled();
    expect(queryButton(/^give up$/i)).toBeInTheDocument();
  });

  it('takes no more than you have left, so the balance never goes below zero', async () => {
    balance = 12; // 10 for the bet leaves 2
    const user = await becomeLandlord();
    await user.click(button(/^give up$/i));
    await user.click(button(/^yes, give up$/i));
    expect(wager).toHaveBeenLastCalledWith(2);
    expect(balance).toBe(0);
  });
});

describe('a whole round', () => {
  it('can be played to the end with Hint and Play, and pays out exactly once', async () => {
    const user = await becomeLandlord();
    for (let i = 0; i < 80 && !screen.queryByText(/you win|you lose/i); i++) {
      if (queryButton(/^hint$/i) && !button(/^hint$/i).hasAttribute('disabled')) {
        await user.click(button(/^hint$/i));
        if (button(/^play$/i).hasAttribute('disabled')) await user.click(button(/^pass$/i));
        else await user.click(button(/^play$/i));
      }
      await advance(2000);
    }
    expect(screen.getByText(/you win|you lose/i)).toBeInTheDocument();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(queryButton(/^deal again$/i)).toBeInTheDocument();
  });
});

describe('the rule switches', () => {
  it('lists the four switches, with the house straight flush off', async () => {
    const user = setup();
    await user.click(button(/^settings$/i));
    expect(screen.getByLabelText(/planes/i)).toBeChecked();
    expect(screen.getByLabelText(/four with two/i)).toBeChecked();
    expect(screen.getByLabelText(/runs of pairs/i)).toBeChecked();
    expect(screen.getByLabelText(/straight flush/i)).not.toBeChecked();
  });

  it('remembers a change in the browser', async () => {
    const user = setup();
    await user.click(button(/^settings$/i));
    await user.click(screen.getByLabelText(/straight flush/i));
    expect(window.localStorage.getItem('card-casino.settings.landlord')).toContain('"straightFlush":true');
  });
});

describe('in Chinese', () => {
  it('shows the game in Chinese', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    setup();
    expect(button('发牌')).toBeInTheDocument();
  });
});
