// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ADMIN_PASSWORD_SHA256, checkAdminPassword } from '../adminGate';
import { AdminGate } from './AdminGate';

afterEach(() => cleanup());

// Built from pieces so the real password is not written in this file.
const RIGHT = ['Gre@t', 'Gl@g', 'VSE', 'nf0s0'].join('');

describe('the admin password check', () => {
  it('accepts the password and nothing else', async () => {
    expect(await checkAdminPassword(RIGHT)).toBe(true);
    expect(await checkAdminPassword(RIGHT.toLowerCase())).toBe(false);
    expect(await checkAdminPassword(RIGHT + ' ')).toBe(false);
    expect(await checkAdminPassword('')).toBe(false);
    expect(await checkAdminPassword('password')).toBe(false);
  });

  it('keeps only a fingerprint of the password, not the password', () => {
    expect(ADMIN_PASSWORD_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(ADMIN_PASSWORD_SHA256).not.toContain(RIGHT);
  });
});

describe('the admin password page', () => {
  const setup = () => {
    const onUnlock = vi.fn();
    const onCancel = vi.fn();
    render(<AdminGate onUnlock={onUnlock} onCancel={onCancel} />);
    return { user: userEvent.setup(), onUnlock, onCancel };
  };

  it('asks only for a password, with the box already selected', () => {
    setup();
    expect(screen.getByRole('dialog', { name: /admin access/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveFocus();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('lets you in with the right password', async () => {
    const { user, onUnlock } = setup();
    await user.type(screen.getByLabelText(/password/i), RIGHT);
    await user.click(screen.getByRole('button', { name: /enter/i }));
    await vi.waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('works with the Enter key too', async () => {
    const { user, onUnlock } = setup();
    await user.type(screen.getByLabelText(/password/i), `${RIGHT}{Enter}`);
    await vi.waitFor(() => expect(onUnlock).toHaveBeenCalledTimes(1));
  });

  it('says so and clears the box on a wrong password, and the message goes when you type again', async () => {
    const { user, onUnlock } = setup();
    await user.type(screen.getByLabelText(/password/i), 'nope');
    await user.click(screen.getByRole('button', { name: /enter/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not right/i);
    expect(screen.getByLabelText(/password/i)).toHaveValue('');
    expect(onUnlock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/password/i), 'x');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not unlock for an empty password', async () => {
    const { user, onUnlock } = setup();
    await user.click(screen.getByRole('button', { name: /enter/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('lets you go back to the game without a password', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: /back to game/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
