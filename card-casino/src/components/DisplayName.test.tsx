// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ApiError, changeDisplayName, getDisplayName } from '../api';
import { DisplayName } from './DisplayName';

const mocks = vi.hoisted(() => ({ update: vi.fn(), logout: vi.fn(), charge: vi.fn() }));
vi.mock('../session', () => ({ useSession: () => ({ session: { idToken: 'token' }, logout: mocks.logout, updateDisplayName: mocks.update }) }));
vi.mock('../wallet', () => ({ useWallet: () => ({ applyExternalChange: mocks.charge }) }));
vi.mock('../api', async (original) => ({ ...(await original<typeof import('../api')>()), getDisplayName: vi.fn(), changeDisplayName: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDisplayName).mockResolvedValue({ displayName: 'Ada', cost: 1000, nextChangeAt: null });
  mocks.charge.mockImplementation((operation: () => unknown) => operation());
});
afterEach(() => cleanup());

it('asks for confirmation before charging, then updates the saved name', async () => {
  vi.mocked(changeDisplayName).mockResolvedValue({ displayName: 'Grace', cost: 1000, nextChangeAt: null, balance: 500, version: 2 });
  render(<DisplayName />);
  const user = userEvent.setup();
  const input = await screen.findByLabelText('New display name');
  await user.clear(input);
  await user.type(input, 'Grace');
  await user.click(screen.getByRole('button', { name: 'Change name' }));
  expect(screen.getByText(/Change your name to Grace for 1,000/)).toBeInTheDocument();
  expect(changeDisplayName).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Confirm and pay' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Your display name has been changed');
  expect(changeDisplayName).toHaveBeenCalledWith('token', 'Grace');
  expect(mocks.charge).toHaveBeenCalledTimes(1);
  expect(mocks.update).toHaveBeenCalledWith('Grace');
});

it('shows the server error without updating the saved name', async () => {
  vi.mocked(changeDisplayName).mockRejectedValue(new ApiError(409, 'DISPLAY_NAME_TAKEN', 'taken'));
  render(<DisplayName />);
  const user = userEvent.setup();
  await screen.findByLabelText('New display name');
  await user.click(screen.getByRole('button', { name: 'Change name' }));
  await user.click(screen.getByRole('button', { name: 'Confirm and pay' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already taken');
  expect(mocks.update).not.toHaveBeenCalled();
});