import { describe, expect, it } from 'vitest';
import { validateRegistration } from './validate';

describe('validateRegistration', () => {
  const valid = { displayName: 'CardShark', email: 'ada@example.com', password: 'bricks123' };

  it('accepts valid input', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('rejects a bad email', () => {
    expect(validateRegistration({ ...valid, email: 'nope' }).email).toBeTruthy();
  });

  it.each(['short1', 'onlyletters', '12345678'])('rejects weak password %s', (password) => {
    expect(validateRegistration({ ...valid, password }).password).toBeTruthy();
  });

  it.each(['ab', 'x'.repeat(21), 'bad<name>'])('rejects display name %s', (displayName) => {
    expect(validateRegistration({ ...valid, displayName }).displayName).toBeTruthy();
  });

  it('reports every invalid field at once', () => {
    const errors = validateRegistration({ displayName: '', email: 'x', password: '' });
    expect(Object.keys(errors).sort()).toEqual(['displayName', 'email', 'password']);
  });
});
