// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider, STORAGE_KEY, translate, type Translate } from './i18n';
import { zhCN } from './i18n/zh-CN';
import { WalletProvider } from './wallet';
import { SessionContext, type Session } from './session';
import { newDeck, shuffle } from './cards';
import { CrazyEights } from './games/CrazyEights';
import { Klondike } from './games/Klondike';
import { Holdem } from './games/Holdem';
import { Gin } from './games/Gin';
import { crazyEightsLog, ginLog } from './games/gameLogs';
import { botTurn, drawForPlayer, isPlayable, playCard, startCrazyEights } from './games/crazyEightsRules';
import { BUY_IN, SEAT_COUNT, act, startHand } from './games/holdemRules';
import { botAction } from './games/holdemBots';
import { describeResult, formatLog } from './games/holdemTable';
import {
  discardCard,
  drawFromStock,
  knock,
  knockOption,
  mustDrawStock,
  passUpcard,
  startMatch,
  type GinHand,
} from './games/ginRules';
import { botStep } from './games/ginBot';
import { fakeBalanceServer } from './testBalanceServer';
import * as api from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, getBalance: vi.fn(), saveBalance: vi.fn() };
});

const tZh: Translate = (key, values) => translate('zh-CN', key, values);
const t = (key: keyof typeof zhCN, values?: Record<string, string | number>) => translate('zh-CN', key, values);

/** English words (two letters or more). Card ranks such as A, K or 10 are not words. */
const hasEnglish = (s: string) => /[A-Za-z]{2,}/.test(s);

describe('Crazy Eights log lines', () => {
  it('shows a line as it is in British English', () => {
    expect(crazyEightsLog('You played K♠.', 'en-GB', tZh)).toBe('You played K♠.');
  });

  it('words every kind of line in Chinese', () => {
    const lines: [string, string][] = [
      ['Your turn.', t('crazy.log.yourTurn')],
      ['You played K♠.', t('crazy.log.played', { card: 'K♠' })],
      ['You played 8♣ and chose ♥.', t('crazy.log.playedEight', { card: '8♣', suit: '♥' })],
      ['You drew 1 card.', t('crazy.log.drew', { cards: t('count.cardOne', { count: 1 }) })],
      ['You drew 3 cards.', t('crazy.log.drew', { cards: t('count.cardMany', { count: 3 }) })],
      ["You drew 2 cards but still can't play. You pass.", t('crazy.log.drewStuck', { cards: t('count.cardMany', { count: 2 }) })],
      ['Nothing left to draw. You pass.', t('crazy.log.nothing')],
      ['Bot passes.', t('crazy.log.botPasses')],
      ["Bot drew 2 cards and can't play. It passes.", t('crazy.log.botDrewPasses', { cards: t('count.cardMany', { count: 2 }) })],
      ['Bot drew 1 card and played 9♦.', t('crazy.log.botDrewPlayed', { cards: t('count.cardOne', { count: 1 }), card: '9♦' })],
      ['Bot drew 2 cards and played 8♠ and chose ♦.', t('crazy.log.botDrewPlayedEight', { cards: t('count.cardMany', { count: 2 }), card: '8♠', suit: '♦' })],
      ['Bot played 10♣.', t('crazy.log.botPlayed', { card: '10♣' })],
      ['Bot played 8♥ and chose ♠.', t('crazy.log.botPlayedEight', { card: '8♥', suit: '♠' })],
    ];
    for (const [english, chinese] of lines) expect(crazyEightsLog(english, 'zh-CN', tZh)).toBe(chinese);
  });

  it('leaves a line it does not know as it is', () => {
    expect(crazyEightsLog('Something new happened.', 'zh-CN', tZh)).toBe('Something new happened.');
  });

  it('leaves no English in the log of real games', () => {
    for (let game = 0; game < 25; game++) {
      let s = startCrazyEights(shuffle(newDeck()), 10);
      const seen = [s.log];
      for (let step = 0; step < 300 && s.status === 'playing'; step++) {
        if (s.turn === 'bot') s = botTurn(s);
        else {
          const at = s.player.findIndex((c) => isPlayable(c, s));
          s = at >= 0 ? playCard(s, at, 'hearts') : drawForPlayer(s);
        }
        seen.push(s.log);
      }
      for (const line of seen) expect(hasEnglish(crazyEightsLog(line, 'zh-CN', tZh)), line).toBe(false);
    }
  });
});

describe('Texas Hold\'em lines in Chinese', () => {
  it('words every action and the result in Chinese, for real hands', () => {
    for (let game = 0; game < 25; game++) {
      let hand = startHand(Array(SEAT_COUNT).fill(BUY_IN), game % SEAT_COUNT, shuffle(newDeck()));
      for (let step = 0; step < 100 && !hand.over; step++) hand = act(hand, botAction(hand));
      expect(hand.over).toBe(true);
      for (const line of formatLog(hand.log, tZh)) expect(hasEnglish(line), line).toBe(false);
      const { text } = describeResult(hand, tZh);
      expect(hasEnglish(text), text).toBe(false);
    }
  });

  it('still words them in British English by default', () => {
    expect(formatLog(['Seat 1 calls 2.', 'Seat 0 folds.', 'Dealt the flop.'])).toEqual(['Bot 1 calls 2.', 'You fold.', 'Dealt the flop.']);
  });

  it('names the seats and the hand in Chinese', () => {
    let hand = startHand(Array(SEAT_COUNT).fill(BUY_IN), 0, shuffle(newDeck()));
    for (let step = 0; step < 100 && !hand.over; step++) hand = act(hand, botAction(hand));
    const lines = formatLog(['Seat 1 posts the small blind, seat 0 the big blind.'], tZh);
    expect(lines[0]).toBe(t('holdem.log.blindsYouBig', { small: t('seat.bot1') }));
  });
});

describe('Gin Rummy log lines', () => {
  it('shows a line as it is in British English', () => {
    expect(ginLog('Bot took the 5♥.', 'en-GB', tZh)).toBe('Bot took the 5♥.');
  });

  it('words every kind of line in Chinese, including lines with two sentences', () => {
    const who = (name: 'You' | 'Bot') => t(name === 'You' ? 'gin.who.you' : 'gin.who.bot');
    expect(ginLog('You are first to act. The 5♥ is turned up.', 'zh-CN', tZh)).toBe(
      t('gin.log.firstToAct', { who: t('gin.log.firstYou'), card: '5♥' }),
    );
    expect(ginLog('Bot passed on the K♠. Nobody wanted it.', 'zh-CN', tZh)).toBe(
      `${t('gin.log.passed', { who: who('Bot'), card: 'K♠' })} ${t('gin.log.nobody')}`,
    );
    expect(ginLog('Bot took the 5♥ from the pile.', 'zh-CN', tZh)).toBe(t('gin.log.tookPile', { who: who('Bot'), card: '5♥' }));
    expect(ginLog('You took the 5♥.', 'zh-CN', tZh)).toBe(t('gin.log.took', { who: who('You'), card: '5♥' }));
    expect(ginLog('You drew from the stock.', 'zh-CN', tZh)).toBe(t('gin.log.drewStock', { who: who('You') }));
    expect(ginLog('Bot knocked with 7.', 'zh-CN', tZh)).toBe(t('gin.log.knocked', { who: who('Bot'), points: 7 }));
    expect(ginLog('You went gin!', 'zh-CN', tZh)).toBe(t('gin.log.gin', { who: who('You') }));
    expect(ginLog('You discarded the 2♣. Only 2 cards are left in the stock, so the hand is a draw.', 'zh-CN', tZh)).toBe(
      `${t('gin.log.discarded', { who: who('You'), card: '2♣' })} ${t('gin.log.drawn', { count: 2 })}`,
    );
  });

  it('leaves no English in the log of real hands', () => {
    for (let game = 0; game < 20; game++) {
      let hand: GinHand = startMatch(shuffle(newDeck()), 50, game % 2 ? 'player' : 'bot').hand;
      const seen = [hand.log];
      for (let step = 0; step < 400 && hand.phase !== 'over'; step++) {
        if (hand.turn === 'bot') hand = botStep(hand);
        else if (hand.phase === 'offer') hand = passUpcard(hand);
        else if (hand.phase === 'draw') hand = drawFromStock(hand);
        else {
          const knockAt = hand.player.findIndex((_, i) => knockOption(hand, i).allowed);
          hand = knockAt >= 0 ? knock(hand, knockAt) : discardCard(hand, 0);
        }
        seen.push(hand.log);
      }
      expect(mustDrawStock).toBeDefined();
      for (const line of seen) expect(hasEnglish(ginLog(line, 'zh-CN', tZh)), line).toBe(false);
    }
  });
});

const session: Session = {
  idToken: 'tok',
  expiresAt: Date.now() + 3_600_000,
  user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
};

async function inChinese(ui: React.ReactElement, ready: () => Promise<unknown> = () => screen.findByLabelText(t('common.bet'))) {
  window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
  const view = render(
    <LanguageProvider>
      <SessionContext.Provider value={{ session, logout: vi.fn() }}>
        <WalletProvider saveDelayMs={20}>{ui}</WalletProvider>
      </SessionContext.Provider>
    </LanguageProvider>,
  );
  await ready();
  return view;
}

const ENGLISH_UI = /\b(Deal|Bet|Max|Bot|You|cards|coins|stock|Draw|Pass|Fold|Check|Call|Raise|Knock|Forfeit|Pile|Suit|left|Hand|Leave|Sit|thinking|win|lost)\b/;
const noEnglish = (c: HTMLElement) => expect(c.textContent ?? '').not.toMatch(ENGLISH_UI);

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  const server = fakeBalanceServer();
  vi.mocked(api.getBalance).mockImplementation(server.get);
  vi.mocked(api.saveBalance).mockImplementation(server.save);
});
afterEach(() => cleanup());

describe('Crazy Eights in Chinese', () => {
  it('shows the table, the piles and the buttons in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<CrazyEights />);
    expect(screen.getByRole('heading', { name: t('game.crazy-eights.name') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    expect(container.textContent).toContain(t('crazy.botHand', { count: 7 }));
    expect(container.textContent).toContain(t('crazy.youHand', { count: 7 }));
    expect(container.textContent).toContain(t('crazy.log.yourTurn'));
    expect(container.textContent).toMatch(/花色：/);
    expect(screen.getByRole('button', { name: new RegExp(`${t('crazy.drawCards')}|出一张牌`) })).toBeInTheDocument();
    noEnglish(container);
  });
});

describe('Klondike in Chinese', () => {
  it('shows the status, the hint and the buttons in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<Klondike />);
    expect(screen.getByRole('heading', { name: t('game.klondike.name') })).toBeInTheDocument();
    expect(screen.getByText(t('klondike.hint'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    expect(container.querySelector('.result')?.textContent).toContain('牌堆剩余');
    expect(screen.getAllByRole('button', { name: new RegExp(t('klondike.emptyFoundation', { n: 1 })) }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: t('klondike.giveUp') }));
    expect(container.querySelector('.result')?.textContent).toMatch(/没有可走的步了/);
    expect(screen.getByRole('button', { name: t('klondike.dealNew') })).toBeInTheDocument();
    noEnglish(container);
  });
});

describe("Texas Hold'em in Chinese", () => {
  it('shows the sit-down page, the table and the actions in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<Holdem />, () => screen.findByRole('button', { name: t('holdem.sit', { buyIn: BUY_IN }) }));
    expect(screen.getByRole('heading', { name: t('game.holdem.name') })).toBeInTheDocument();
    expect(screen.getByText(t('holdem.intro', { buyIn: BUY_IN }))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('holdem.sit', { buyIn: BUY_IN }) }));
    expect(container.textContent).toContain(t('seat.bot1'));
    expect(container.textContent).toContain(t('holdem.seatCoins', { stack: BUY_IN }).replace(String(BUY_IN), '') );
    expect(screen.getByRole('button', { name: t('holdem.fold') })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: t('holdem.logLabel') })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: t('holdem.logLabel') })).getAllByRole('listitem')[0]).toHaveTextContent(/小盲注/);
    expect(screen.getByRole('button', { name: new RegExp(t('holdem.leave', { stack: BUY_IN }).replace(/[()（）]/g, '.')) })).toBeDisabled();
    noEnglish(container);
  });
});

describe('Gin Rummy in Chinese', () => {
  it('shows the score line, the piles and the choices in Chinese', async () => {
    const user = userEvent.setup();
    const { container } = await inChinese(<Gin />);
    expect(screen.getByRole('heading', { name: t('game.gin-rummy.name') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('game.deal') }));
    const score = screen.getByLabelText(t('gin.scoreLabel'));
    expect(score).toHaveTextContent('第 1 局');
    expect(score).toHaveTextContent(/你发牌|机器人发牌/);
    expect(container.textContent).toContain(t('gin.youHand', { count: 10 }).split(' · ')[0]);
    expect(container.textContent).toContain(t('gin.pile'));
    expect(screen.getByRole('button', { name: t('gin.forfeit') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('gin.forfeit') }));
    expect(screen.getByRole('group', { name: t('gin.forfeitGroup') })).toHaveTextContent(t('gin.forfeitAsk', { bet: 50 }));
    await user.click(screen.getByRole('button', { name: t('gin.yesForfeit') }));
    expect(container.querySelector('.result')?.textContent).toContain(t('gin.youForfeited', { loss: '' }).trim().split('。')[0]);
    noEnglish(container);
  });
});
