import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, confirmUser, registerUser, resendCode } from '../api';
import { validateRegistration, type FieldErrors } from '../validate';

type Step = 'form' | 'confirm' | 'done';

interface Outcome {
  general?: string;
  fields?: FieldErrors;
  canResend?: boolean;
}

function describe(err: unknown): Outcome {
  if (!(err instanceof ApiError)) return { general: 'Something went wrong. Please try again.' };
  switch (err.code) {
    case 'VALIDATION_ERROR':
      return { fields: (err.fields ?? {}) as FieldErrors, general: err.fields ? undefined : err.message };
    case 'EMAIL_TAKEN':
      return {
        fields: { email: 'An account with this email already exists.' },
        canResend: err.details?.canResendCode === true,
      };
    case 'DISPLAY_NAME_TAKEN':
      return { fields: { displayName: 'That display name is already taken.' } };
    case 'CODE_INVALID':
      return { fields: { code: 'The confirmation code is incorrect.' } };
    case 'CODE_EXPIRED':
      return { fields: { code: 'That code has expired. Request a new one.' } };
    case 'RATE_LIMITED':
      return { general: 'Too many requests. Please wait a moment and try again.' };
    case 'NETWORK_ERROR':
      return { general: 'Could not reach the server. Check your connection and try again.' };
    default:
      return { general: 'Something went wrong. Please try again.' };
  }
}

export function RegisterForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string>();
  const [canResend, setCanResend] = useState(false);
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);

  const clear = () => {
    setErrors({});
    setGeneral(undefined);
    setCanResend(false);
    setInfo(undefined);
  };
  const fail = (err: unknown) => {
    const outcome = describe(err);
    setErrors(outcome.fields ?? {});
    setGeneral(outcome.general);
    setCanResend(outcome.canResend ?? false);
  };
  const edit = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    clear();
    const payload = {
      displayName: form.displayName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    };
    const local = validateRegistration(payload);
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    try {
      await registerUser(payload);
      setForm((f) => ({ ...f, email: payload.email }));
      setStep('confirm');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    clear();
    if (!/^\d{6}$/.test(code)) return setErrors({ code: 'Enter the 6-digit code from your email.' });
    setBusy(true);
    try {
      await confirmUser({ email: form.email, code });
      setStep('done');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    clear();
    setBusy(true);
    try {
      await resendCode({ email: form.email.trim().toLowerCase() });
      setStep('confirm');
      setInfo('We sent you a new code.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Account pending approval</h1>
          <p className="hint">
            Thanks, your email is confirmed. An admin will review your account, and you can log in once it is approved.
          </p>
          <button className="primary" type="button" onClick={onBack}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="login">
        <form className="login-card" onSubmit={onConfirm} noValidate>
          <h1>Check your email</h1>
          <p className="hint">
            We sent a 6-digit code to <strong>{form.email}</strong>. Enter it to confirm your email address.
          </p>
          {info && <p role="status">{info}</p>}
          {general && <p role="alert" className="login-error">{general}</p>}
          <label>
            Confirmation code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              aria-invalid={!!errors.code}
            />
          </label>
          {errors.code && <p className="login-error">{errors.code}</p>}
          <button className="primary" type="submit" disabled={busy}>
            Confirm
          </button>
          <button type="button" onClick={onResend} disabled={busy}>
            Resend code
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onRegister} noValidate>
        <h1>Create your account</h1>
        {general && <p role="alert" className="login-error">{general}</p>}

        <label>
          Display name
          <input
            autoComplete="nickname"
            autoFocus
            value={form.displayName}
            onChange={edit('displayName')}
            aria-invalid={!!errors.displayName}
          />
        </label>
        {errors.displayName ? (
          <p className="login-error">{errors.displayName}</p>
        ) : (
          <p className="hint">3–20 characters. This is the name other players see.</p>
        )}

        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={edit('email')}
            aria-invalid={!!errors.email}
          />
        </label>
        {errors.email && <p className="login-error">{errors.email}</p>}
        {canResend && (
          <button type="button" onClick={onResend} disabled={busy}>
            Resend the code to confirm this account
          </button>
        )}

        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={edit('password')}
            aria-invalid={!!errors.password}
          />
        </label>
        {errors.password ? (
          <p className="login-error">{errors.password}</p>
        ) : (
          <p className="hint">At least 8 characters, with a letter and a number.</p>
        )}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <button type="button" onClick={onBack}>
          Back to login
        </button>
      </form>
    </div>
  );
}
