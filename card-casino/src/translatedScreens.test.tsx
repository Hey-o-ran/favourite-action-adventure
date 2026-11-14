// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider, STORAGE_KEY } from './i18n';
import { zhCN } from './i18n/zh-CN';
import { AuthGate } from './components/AuthGate';
import { RegisterForm } from './components/RegisterForm';
import { SaveStatus } from './components/SaveStatus';
import { WalletContext, WalletProvider, type WalletValue } from './wallet';
import { SessionContext, type Session } from './session';
import { validateRegistration } from './validate';
import { CONFLICT_NOTICE, RESET_NOTICE } from './balanceSync';
import * as api from './api';
import { ApiError } from './api';

vi.mock('./api', async (orig) => {
  const actual = await orig<typeof import('./api')>();
  return { ...actual, login: vi.fn(), registerUser: vi.fn(), confirmUser: vi.fn(), resendCode: vi.fn(), getBalance: vi.fn() };
});

const inChinese = (ui: React.ReactElement) => {
  window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe('login in Chinese', () => {
  it('shows the login screen in Chinese', () => {
    inChinese(
      <AuthGate>
        <p>in</p>
      </AuthGate>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(zhCN['header.title']);
    expect(screen.getByLabelText(zhCN['login.email'])).toBeInTheDocument();
    expect(screen.getByLabelText(zhCN['login.password'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhCN['login.submit'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhCN['login.register'] })).toBeInTheDocument();
  });

  it('explains a problem in Chinese', async () => {
    const user = userEvent.setup();
    inChinese(
      <AuthGate>
        <p>in</p>
      </AuthGate>,
    );
    await user.click(screen.getByRole('button', { name: zhCN['login.submit'] }));
    expect(screen.getByRole('alert')).toHaveTextContent(zhCN['login.enterBoth']);

    vi.mocked(api.login).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'x'));
    await user.type(screen.getByLabelText(zhCN['login.email']), 'ada@example.com');
    await user.type(screen.getByLabelText(zhCN['login.password']), 'secret123');
    await user.click(screen.getByRole('button', { name: zhCN['login.submit'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(zhCN['login.invalid']);
  });

  it.each([
    ['ACCOUNT_PENDING', 'login.pending'],
    ['EMAIL_NOT_CONFIRMED', 'login.notConfirmed'],
    ['RATE_LIMITED', 'error.rateLimited'],
    ['NETWORK_ERROR', 'error.network'],
    ['SOMETHING_ELSE', 'error.generic'],
  ] as const)('explains %s in Chinese', async (code, key) => {
    vi.mocked(api.login).mockRejectedValue(new ApiError(400, code, 'x'));
    const user = userEvent.setup();
    inChinese(
      <AuthGate>
        <p>in</p>
      </AuthGate>,
    );
    await user.type(screen.getByLabelText(zhCN['login.email']), 'ada@example.com');
    await user.type(screen.getByLabelText(zhCN['login.password']), 'secret123');
    await user.click(screen.getByRole('button', { name: zhCN['login.submit'] }));
    expect(await screen.findByRole('alert')).toHaveTextContent(zhCN[key]);
  });
});

describe('registration in Chinese', () => {
  it('shows the form, and checks it in Chinese', async () => {
    const user = userEvent.setup();
    inChinese(<RegisterForm onBack={() => {}} />);
    expect(screen.getByRole('heading', { name: zhCN['register.title'] })).toBeInTheDocument();
    expect(screen.getByText(zhCN['register.displayNameHint'])).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: zhCN['register.submit'] }));
    expect(screen.getByText(zhCN['validate.nameShort'])).toBeInTheDocument();
    expect(screen.getByText(zhCN['validate.email'])).toBeInTheDocument();
    expect(screen.getByText(zhCN['validate.passwordShort'])).toBeInTheDocument();
  });

  it('explains a taken email and name in Chinese', async () => {
    vi.mocked(api.registerUser).mockRejectedValueOnce(new ApiError(409, 'EMAIL_TAKEN', 'x', undefined, { canResendCode: true }));
    const user = userEvent.setup();
    inChinese(<RegisterForm onBack={() => {}} />);
    await user.type(screen.getByLabelText(zhCN['register.displayName']), 'Ada');
    await user.type(screen.getByLabelText(zhCN['login.email']), 'ada@example.com');
    await user.type(screen.getByLabelText(zhCN['login.password']), 'secret123');
    await user.click(screen.getByRole('button', { name: zhCN['register.submit'] }));
    expect(await screen.findByText(zhCN['register.emailTaken'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhCN['register.resendToConfirm'] })).toBeInTheDocument();
  });

  it('asks for the code in Chinese, with the email address filled in', async () => {
    vi.mocked(api.registerUser).mockResolvedValue({ userId: 'u', email: 'ada@example.com', displayName: 'Ada', status: 'UNCONFIRMED' });
    const user = userEvent.setup();
    inChinese(<RegisterForm onBack={() => {}} />);
    await user.type(screen.getByLabelText(zhCN['register.displayName']), 'Ada');
    await user.type(screen.getByLabelText(zhCN['login.email']), 'ada@example.com');
    await user.type(screen.getByLabelText(zhCN['login.password']), 'secret123');
    await user.click(screen.getByRole('button', { name: zhCN['register.submit'] }));
    expect(await screen.findByRole('heading', { name: zhCN['register.confirmTitle'] })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: zhCN['register.confirm'] }));
    expect(screen.getByText(zhCN['register.codeFormat'])).toBeInTheDocument();
  });

  it('says the account is pending approval in Chinese', async () => {
    vi.mocked(api.registerUser).mockResolvedValue({ userId: 'u', email: 'ada@example.com', displayName: 'Ada', status: 'UNCONFIRMED' });
    vi.mocked(api.confirmUser).mockResolvedValue({ email: 'ada@example.com', status: 'CONFIRMED' });
    const user = userEvent.setup();
    inChinese(<RegisterForm onBack={() => {}} />);
    await user.type(screen.getByLabelText(zhCN['register.displayName']), 'Ada');
    await user.type(screen.getByLabelText(zhCN['login.email']), 'ada@example.com');
    await user.type(screen.getByLabelText(zhCN['login.password']), 'secret123');
    await user.click(screen.getByRole('button', { name: zhCN['register.submit'] }));
    await user.type(await screen.findByLabelText(zhCN['register.code']), '123456');
    await user.click(screen.getByRole('button', { name: zhCN['register.confirm'] }));
    expect(await screen.findByRole('heading', { name: zhCN['register.pendingTitle'] })).toBeInTheDocument();
  });
});

describe('checking the registration form', () => {
  it('still gives English messages when asked for none in particular', () => {
    expect(validateRegistration({ displayName: 'ab', email: 'x', password: 'short' })).toEqual({
      displayName: 'Display name must be at least 3 characters',
      email: 'Enter a valid email address',
      password: 'Password must be at least 8 characters',
    });
  });
});

const walletWith = (over: Partial<WalletValue>): WalletValue =>
  ({
  balance: 1000,
  wager: () => true,
  settle: () => {},
  flush: async () => {},
  status: 'saved',
  dismissNotice: () => {},
  ...over,
}) as WalletValue; // a cast, so the fake keeps working as the wallet gains functions

describe('saving the balance in Chinese', () => {
  const session: Session = {
    idToken: 'tok',
    expiresAt: Date.now() + 60_000,
    user: { userId: 'u1', email: 'x@example.com', displayName: 'Ada', isAdmin: false },
  };

  it('shows the loading text and the load error in Chinese', async () => {
    vi.mocked(api.getBalance).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));
    inChinese(
      <SessionContext.Provider value={{ session, logout: vi.fn() }}>
        <WalletProvider>
          <p>in</p>
        </WalletProvider>
      </SessionContext.Provider>,
    );
    expect(screen.getByText(zhCN['wallet.loading'])).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(zhCN['wallet.loadError']);
    expect(screen.getByRole('button', { name: zhCN['wallet.tryAgain'] })).toBeInTheDocument();
  });

  it.each([
    [CONFLICT_NOTICE, 'save.conflict'],
    [RESET_NOTICE, 'save.reset'],
  ] as const)('shows the balance notice in Chinese', (notice, key) => {
    inChinese(
      <WalletContext.Provider value={walletWith({ status: 'saved', notice })}>
        <SaveStatus />
      </WalletContext.Provider>,
    );
    expect(screen.getByText(zhCN[key])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: zhCN['save.dismiss'] })).toBeInTheDocument();
  });

  it('keeps an unknown notice as it is, and says in Chinese when saving failed', () => {
    inChinese(
      <WalletContext.Provider value={walletWith({ status: 'failed', notice: 'Something else' })}>
        <SaveStatus />
      </WalletContext.Provider>,
    );
    expect(screen.getByText('Something else')).toBeInTheDocument();
    expect(screen.getByText(zhCN['save.failed'])).toBeInTheDocument();
  });
});
