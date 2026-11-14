import type { RegisterRequest } from './api';
import { translate, type Translate } from './i18n';

export type FieldErrors = Partial<Record<keyof RegisterRequest | 'code', string>>;

/** British English unless a translator is passed in, so callers and tests that don't care about language still work. */
const english: Translate = (key, values) => translate('en-GB', key, values);

/** Mirrors the API's rules for instant feedback; the server stays the source of truth. */
export function validateRegistration(input: RegisterRequest, t: Translate = english): FieldErrors {
  const errors: FieldErrors = {};

  const name = input.displayName.trim();
  if (name.length < 3) errors.displayName = t('validate.nameShort');
  else if (name.length > 20) errors.displayName = t('validate.nameLong');
  else if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
    errors.displayName = t('validate.nameChars');
  }

  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = t('validate.email');

  const pw = input.password;
  if (pw.length < 8) errors.password = t('validate.passwordShort');
  else if (pw.length > 128) errors.password = t('validate.passwordLong');
  else if (!/[A-Za-z]/.test(pw)) errors.password = t('validate.passwordLetter');
  else if (!/[0-9]/.test(pw)) errors.password = t('validate.passwordNumber');

  return errors;
}
