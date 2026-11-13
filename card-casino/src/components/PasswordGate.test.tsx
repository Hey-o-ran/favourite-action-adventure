// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PasswordGate } from './PasswordGate';
import * as api from '../api';
import { ApiError } from '../api';

vi.mock('../api', async (orig) => {
  const actual = await orig<typeof import('../api')>();
  return { ...actual, registerUser: vi.fn(), confirmUser: vi.fn(), resendCode: vi.fn() };
});

const renderGate = () =>
  render(
    <PasswordGate>
      <p>The casino floor</p>
    </PasswordGate>,
  );

beforeEach(() => {
  vi.resetAllMocks();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe('login page (logic unchanged)', () => {
  it('shows the login with a Register button', () => {
    renderGate();
    expect(screen.getByRole('heading', { name: /card casino/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^enter$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('still rejects a wrong password', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));
    expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
    expect(screen.queryByText(/the casino floor/i)).not.toBeInTheDocument();
  });

  it('still unlocks with the right password', async () => {
    const user = userEvent.setup();
    renderGate();
    await user.type(screen.getByLabelText(/password/i), 'Haoran');
    await user.click(screen.getByRole('button', { name: /^enter$/i }));
    expect(screen.getByText(/the casino floor/i)).toBeInTheDocument();
  });
});

async function openRegistration(user: ReturnType<typeof userEvent.setup>) {
  renderGate();
  await user.click(screen.getByRole('button', { name: /register/i }));
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, over: Partial<Record<string, string>> = {}) {
  await user.type(screen.getByLabelText(/display name/i), over.displayName ?? 'CardShark');
  await user.type(screen.getByLabelText(/email/i), over.email ?? 'ada@example.com');
  await user.type(screen.getByLabelText(/^password/i), over.password ?? 'bricks123');
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

const registered = { userId: 'u1', email: 'ada@example.com', displayName: 'CardShark', status: 'UNCONFIRMED' as const };

describe('registration page', () => {
  it('opens from the Register button with display name, email and password', async () => {
    const user = userEvent.setup();
    await openRegistration(user);
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it('goes back to the login page', async () => {
    const user = userEvent.setup();
    await openRegistration(user);
    await user.click(screen.getByRole('button', { name: /back to login/i }));
    expect(screen.getByRole('button', { name: /^enter$/i })).toBeInTheDocument();
  });

  it('blocks invalid input without calling the API', async () => {
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user, { email: 'nope', password: 'short', displayName: 'a' });
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(api.registerUser).not.toHaveBeenCalled();
  });

  it('sends the details to the API and moves to the email confirmation step', async () => {
    vi.mocked(api.registerUser).mockResolvedValue(registered);
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    expect(api.registerUser).toHaveBeenCalledWith({
      displayName: 'CardShark',
      email: 'ada@example.com',
      password: 'bricks123',
    });
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
  });

  it('shows a taken email, with resend for unconfirmed accounts', async () => {
    vi.mocked(api.registerUser).mockRejectedValue(
      new ApiError(409, 'EMAIL_TAKEN', 'exists', undefined, { canResendCode: true }),
    );
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend the code/i })).toBeInTheDocument();
  });

  it('shows a taken display name on that field', async () => {
    vi.mocked(api.registerUser).mockRejectedValue(new ApiError(409, 'DISPLAY_NAME_TAKEN', 'taken'));
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    expect(await screen.findByText(/display name is already taken/i)).toBeInTheDocument();
  });

  it('maps server field errors onto the fields', async () => {
    vi.mocked(api.registerUser).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'bad', { password: 'Password does not meet the password policy' }),
    );
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    expect(await screen.findByText(/does not meet the password policy/i)).toBeInTheDocument();
  });

  it('shows a friendly message when rate limited', async () => {
    vi.mocked(api.registerUser).mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'slow'));
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
  });

  it('confirms the email, then explains the account is pending admin approval', async () => {
    vi.mocked(api.registerUser).mockResolvedValue(registered);
    vi.mocked(api.confirmUser).mockResolvedValue({ email: 'ada@example.com', status: 'CONFIRMED' });
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    await user.type(await screen.findByLabelText(/confirmation code/i), '123456');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(api.confirmUser).toHaveBeenCalledWith({ email: 'ada@example.com', code: '123456' });
    expect(await screen.findByRole('heading', { name: /pending approval/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to login/i }));
    expect(screen.getByRole('button', { name: /^enter$/i })).toBeInTheDocument();
  });

  it('shows an error for a wrong code and can resend it', async () => {
    vi.mocked(api.registerUser).mockResolvedValue(registered);
    vi.mocked(api.confirmUser).mockRejectedValue(new ApiError(400, 'CODE_INVALID', 'bad code'));
    vi.mocked(api.resendCode).mockResolvedValue(undefined);
    const user = userEvent.setup();
    await openRegistration(user);
    await fillAndSubmit(user);
    await user.type(await screen.findByLabelText(/confirmation code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(await screen.findByText(/code is incorrect/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /resend code/i }));
    expect(api.resendCode).toHaveBeenCalledWith({ email: 'ada@example.com' });
  });
});
