import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, confirmUser, registerUser, resendCode } from '../api';
import { useI18n, type Translate } from '../i18n';
import { validateRegistration, type FieldErrors } from '../validate';

type Step = 'form' | 'confirm' | 'done';

interface Outcome {
  general?: string;
  fields?: FieldErrors;
  canResend?: boolean;
}

function describe(err: unknown, t: Translate): Outcome {
  if (!(err instanceof ApiError)) return { general: t('error.generic') };
  switch (err.code) {
    case 'VALIDATION_ERROR':
      // The server's own wording is English, so it is shown as it comes only when it names a field we have no text for.
      return { fields: (err.fields ?? {}) as FieldErrors, general: err.fields ? undefined : err.message };
    case 'EMAIL_TAKEN':
      return {
        fields: { email: t('register.emailTaken') },
        canResend: err.details?.canResendCode === true,
      };
    case 'DISPLAY_NAME_TAKEN':
      return { fields: { displayName: t('register.nameTaken') } };
    case 'CODE_INVALID':
      return { fields: { code: t('register.codeWrong') } };
    case 'CODE_EXPIRED':
      return { fields: { code: t('register.codeExpired') } };
    case 'RATE_LIMITED':
      return { general: t('error.rateLimited') };
    case 'NETWORK_ERROR':
      return { general: t('error.network') };
    default:
      return { general: t('error.generic') };
  }
}

export function RegisterForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
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
    const outcome = describe(err, t);
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
    const local = validateRegistration(payload, t);
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
    if (!/^\d{6}$/.test(code)) return setErrors({ code: t('register.codeFormat') });
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
      setInfo(t('register.newCodeSent'));
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
          <h1>{t('register.pendingTitle')}</h1>
          <p className="hint">{t('register.pendingText')}</p>
          <button className="primary" type="button" onClick={onBack}>
            {t('register.backToLogin')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    // The email address is shown in bold inside the sentence, so the sentence is split around it.
    const [before, after] = t('register.confirmIntro', { email: '\u0000' }).split('\u0000');
    return (
      <div className="login">
        <form className="login-card" onSubmit={onConfirm} noValidate>
          <h1>{t('register.confirmTitle')}</h1>
          <p className="hint">
            {before}
            <strong>{form.email}</strong>
            {after}
          </p>
          {info && <p role="status">{info}</p>}
          {general && <p role="alert" className="login-error">{general}</p>}
          <label>
            {t('register.code')}
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
            {t('register.confirm')}
          </button>
          <button type="button" onClick={onResend} disabled={busy}>
            {t('register.resend')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={onRegister} noValidate>
        <h1>{t('register.title')}</h1>
        {general && <p role="alert" className="login-error">{general}</p>}

        <label>
          {t('register.displayName')}
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
          <p className="hint">{t('register.displayNameHint')}</p>
        )}

        <label>
          {t('login.email')}
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
            {t('register.resendToConfirm')}
          </button>
        )}

        <label>
          {t('login.password')}
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
          <p className="hint">{t('register.passwordHint')}</p>
        )}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? t('register.busy') : t('register.submit')}
        </button>
        <button type="button" onClick={onBack}>
          {t('register.backToLogin')}
        </button>
      </form>
    </div>
  );
}
