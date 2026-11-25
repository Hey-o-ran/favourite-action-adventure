// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { dismissPlayerUpdate, getPlayerUpdate } from '../api';
import { PlayerUpdateBanner } from './PlayerUpdateBanner';

const logout = vi.hoisted(() => vi.fn());
vi.mock('../session', () => ({ useSession: () => ({ session: { idToken: 'token' }, logout }) }));
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), getPlayerUpdate: vi.fn(), dismissPlayerUpdate: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

it('shows a pending update and removes it after the server confirms dismissal', async () => {
  vi.mocked(getPlayerUpdate).mockResolvedValue({ update: { version: 'v1', message: 'New games are ready.' } });
  vi.mocked(dismissPlayerUpdate).mockResolvedValue(undefined);
  render(<PlayerUpdateBanner />);
  expect(await screen.findByText('New games are ready.')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss update' }));
  expect(dismissPlayerUpdate).toHaveBeenCalledWith('token', 'v1');
  expect(screen.queryByText('New games are ready.')).not.toBeInTheDocument();
});

it('keeps the banner visible when dismissal fails', async () => {
  vi.mocked(getPlayerUpdate).mockResolvedValue({ update: { version: 'v1', message: 'New games are ready.' } });
  vi.mocked(dismissPlayerUpdate).mockRejectedValue(new Error('offline'));
  render(<PlayerUpdateBanner />);
  await screen.findByText('New games are ready.');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss update' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again');
  expect(screen.getByText(/New games are ready/)).toBeInTheDocument();
});

it('shows nothing when the server has no update', async () => {
  vi.mocked(getPlayerUpdate).mockResolvedValue({ update: null });
  const { container } = render(<PlayerUpdateBanner />);
  await vi.waitFor(() => expect(getPlayerUpdate).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});