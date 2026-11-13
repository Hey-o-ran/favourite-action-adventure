import type { RegisterRequest } from './api';

export type FieldErrors = Partial<Record<keyof RegisterRequest | 'code', string>>;

/** Mirrors the API's rules for instant feedback; the server stays the source of truth. */
export function validateRegistration(input: RegisterRequest): FieldErrors {
  const errors: FieldErrors = {};

  const name = input.displayName.trim();
  if (name.length < 3) errors.displayName = 'Display name must be at least 3 characters';
  else if (name.length > 20) errors.displayName = 'Display name must be at most 20 characters';
  else if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
    errors.displayName = 'Display name may only contain letters, numbers, spaces, _ and -';
  }

  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address';

  const pw = input.password;
  if (pw.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (pw.length > 128) errors.password = 'Password is too long';
  else if (!/[A-Za-z]/.test(pw)) errors.password = 'Password must contain a letter';
  else if (!/[0-9]/.test(pw)) errors.password = 'Password must contain a number';

  return errors;
}
