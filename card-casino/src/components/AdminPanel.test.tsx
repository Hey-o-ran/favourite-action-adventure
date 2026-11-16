// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AdminPanel } from './AdminPanel';
import { SessionContext, type Session } from '../session';

const session: Session = {
  idToken: 'admin-token',
  expiresAt: Date.now() + 60_000,
  user: { userId: 'admin1', email: 'boss@example.com', displayName: 'Boss', isAdmin: true },
};

const renderPanel = () =>
  render(
    <SessionContext.Provider value={{ session, logout: vi.fn() }}>
      <AdminPanel />
    </SessionContext.Provider>,
  );

beforeEach(() => vi.resetAllMocks());
afterEach(() => cleanup());

describe('admin panel', () => {
  it('has a title, and a section for finding players to give or take coins or ban', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give or take coins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ban' })).toBeInTheDocument();
  });

  it('has the events and the player log too', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /admin abuse/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /player log/i })).toBeInTheDocument();
  });

  it('has no list of accounts waiting for approval, because there is no approval', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for approval/i)).not.toBeInTheDocument();
  });
});
