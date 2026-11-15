// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider, STORAGE_KEY, translate } from './i18n';
import { zhCN } from './i18n/zh-CN';
import { WalletProvider } from './wallet';
import { SessionContext, type Session } from './session';
import { Blackjack } from './games/Blackjack';
import { Baccarat } from './games/Baccarat';
import { RedDog } from './games/RedDog';
import { HigherLower } from './games/HigherLower';
import { VideoPoker } from './games/VideoPoker';
import { JACKPOT_MULTIPLIER } from './games/higherLowerRules';
import { CardView } from './components/CardView';
import { fakeBalanceServer } from './testBalanceServer';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, getBalance: vi.fn(), saveBalance: vi.fn() };
});

const t = (key: keyof typeof zhCN, values?: Record<string, string | number>) => translate('zh-CN', key, values);

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
};

/** Words from the English screens that must not show up anywhere once the player has chosen Chinese. */
const ENGLISH = /\b(Deal|Hit|Stand|Double|Dealer|Player|Banker|Tie|wins|Bet|Max|Hold|Held|Draw|Pays|Hand|Higher|Lower|Start|coins|returned|between|Bust|Push|Streak|pot)\b/;
const noEnglish = (container: HTMLElement) => expect(container.textContent ?? '').not.toMatch(ENGLISH);

async function inChinese(ui: React.ReactElement) {
  window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
  const view = render(
    <LanguageProvider>
      <SessionContext.Provider value={{ session, logout: vi.fn() }}>
        <WalletProvider saveDelayMs={20}>{ui}</WalletProvider>
      </SessionContext.Provider>
    </LanguageProvider>,
  );
  await screen.findByLabelText(t('common.bet'));
  return view;
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  const server = fakeBalanceServer();
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
});
afterEach(() => cleanup());

describe('cards in Chinese', () => {
  it('names a card and a face-down card in Chinese', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    render(
      <LanguageProvider>
        <CardView card={{ rank: 1, suit: 'spades' }} />
        <CardView faceDown />
      </LanguageProvider>,
    );
    expect(screen.getByLabelText(t('card.of', { rank: 'A', suit: t('suit.spades') }))).toBeInTheDocument();
    expect(screen.getByLabelText(t('card.faceDown'))).toBeInTheDocument();
  });

  it('still says "A of spades" in English', () => {
    render(<CardView card={{ rank: 1, suit: 'spades' }} />);
    expect(screen.getByLabelText('A of spades')).toBeInTheDocument();
  });
});

describe('Blackjack in Chinese', () => {
  it('shows the table and the moves in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<Blackjack />);
    expect(screen.getByRole('button', { name: t('game.deal') })).toBeInTheDocument();
    expect(screen.getByLabelText(t('common.bet'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    expect(screen.getByRole('heading', { name: new RegExp(`^${t('blackjack.you')}`) })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: new RegExp(`^${t('blackjack.dealer')}`) })).toBeInTheDocument();
    // Either a move is on offer, or the hand ended at once (a natural) and says how.
    const moves = screen.queryByRole('button', { name: t('blackjack.hit') });
    if (moves) {
      expect(screen.getByRole('button', { name: t('blackjack.stand') })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t('blackjack.double') })).toBeInTheDocument();
      // The moves are switched off for a moment after each deal.
      await vi.waitFor(() => expect(screen.getByRole('button', { name: t('blackjack.stand') })).toBeEnabled());
      await user.click(screen.getByRole('button', { name: t('blackjack.stand') }));
    }
    expect(await screen.findByRole('button', { name: t('game.dealAgain') })).toBeInTheDocument();
    expect(container.querySelector('.result')?.textContent).toMatch(/枚金币/);
    noEnglish(container);
  });
});

describe('Baccarat in Chinese', () => {
  it('shows the sides, the result and the buttons in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<Baccarat />);
    expect(screen.getByRole('heading', { name: t('game.baccarat.name') })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: t('baccarat.betOn') });
    expect(within(group).getByRole('button', { name: new RegExp(t('baccarat.banker')) })).toHaveTextContent(t('baccarat.paysBanker'));
    expect(within(group).getByRole('button', { name: new RegExp(t('baccarat.tie')) })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    expect(await screen.findByRole('button', { name: t('game.dealAgain') })).toBeInTheDocument();
    expect(container.querySelector('.result')?.textContent).toMatch(/获胜。|和局。/);
    noEnglish(container);
  });
});

describe('Red Dog in Chinese', () => {
  it('shows the question, the raise buttons and the result in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<RedDog />);
    expect(screen.getByRole('heading', { name: t('game.red-dog.name') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    const third = screen.queryByRole('button', { name: t('reddog.third') });
    if (third) {
      expect(container.querySelector('.result')?.textContent).toMatch(/赔率/);
      expect(screen.getByRole('button', { name: t('reddog.raise', { amount: 5 }) })).toBeInTheDocument();
      await vi.waitFor(() => expect(third).toBeEnabled());
      await user.click(third);
    }
    expect(await screen.findByRole('button', { name: t('game.dealAgain') })).toBeInTheDocument();
    expect(container.querySelector('.result')?.textContent).not.toBe('');
    noEnglish(container);
  });
});

describe('Higher or Lower in Chinese', () => {
  it('shows the streak, the guesses and the result in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<HigherLower />);
    expect(screen.getByRole('heading', { name: t('game.higher-lower.name') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.start') }));
    expect(container.querySelector('.result')?.textContent).toContain(t('hilo.streak', { streak: 0, pot: 10 }));
    const higher = screen.getByRole('button', { name: t('hilo.higher') });
    expect(screen.getByRole('button', { name: t('hilo.cashOut') })).toBeInTheDocument();
    const jackpot = screen.getByRole('button', { name: t('hilo.jackpot', { multiplier: JACKPOT_MULTIPLIER }) });
    expect(jackpot).toHaveAttribute('title', expect.stringContaining('倍'));
    await vi.waitFor(() => expect(higher).toBeEnabled());
    await user.click(higher);
    noEnglish(container);
  });
});

describe('Jacks or Better in Chinese', () => {
  it('shows the hold buttons, the result and the pay table in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<VideoPoker />);
    expect(screen.getByRole('heading', { name: t('game.video-poker.name') })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t('poker.hand') })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: t('poker.pays') })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: t('hand.Full House') })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: t('hand.Royal Flush') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    expect(screen.getAllByRole('button', { name: t('poker.hold') })).toHaveLength(5);
    await user.click(screen.getAllByRole('button', { name: t('poker.hold') })[0]);
    expect(screen.getByRole('button', { name: t('poker.held') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('poker.draw') }));
    expect(await screen.findByRole('button', { name: t('game.dealAgain') })).toBeInTheDocument();
    expect(container.querySelector('.result')?.textContent).toMatch(/枚金币/);
    noEnglish(container);
  });
});
