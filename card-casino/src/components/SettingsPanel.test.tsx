// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GIN_SETTINGS } from '../games/ginSettings';
import { defaultsOf } from '../gameSettings';
import { SettingsPanel } from './SettingsPanel';

afterEach(() => cleanup());

const setup = (over: Record<string, string | boolean> = {}) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(<SettingsPanel schema={GIN_SETTINGS} values={{ ...defaultsOf(GIN_SETTINGS), ...over }} onChange={onChange} onReset={onReset} />);
  return { user: userEvent.setup(), onChange, onReset };
};

describe('the settings panel', () => {
  it('lists every group and setting the game describes', () => {
    setup();
    for (const heading of ['The bot', 'Rules', 'Modifiers']) expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    for (const legend of ['Bot difficulty', 'Match length', 'When can you knock?']) expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /double bonuses/i })).toBeInTheDocument();
  });

  it('offers every option of a choice as a radio button, with the current one chosen', () => {
    setup({ difficulty: 'hard' });
    const difficulty = screen.getByRole('group', { name: 'Bot difficulty' });
    expect(within(difficulty).getAllByRole('radio')).toHaveLength(3);
    expect(within(difficulty).getByRole('radio', { name: /^Hard/ })).toBeChecked();
    expect(within(difficulty).getByRole('radio', { name: /^Normal/ })).not.toBeChecked();
  });

  it('explains an option under its name', () => {
    setup();
    expect(screen.getByRole('radio', { name: /Hard.*Remembers what you throw away/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Oklahoma.*first card turned up/ })).toBeInTheDocument();
  });

  it('reports a new choice', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('radio', { name: /^Hard/ }));
    expect(onChange).toHaveBeenCalledWith('difficulty', 'hard');
    await user.click(screen.getByRole('radio', { name: /first to 150/ }));
    expect(onChange).toHaveBeenCalledWith('target', '150');
  });

  it('reports a switch being turned on and off', async () => {
    const { user, onChange } = setup();
    await user.click(screen.getByRole('checkbox', { name: /double bonuses/i }));
    expect(onChange).toHaveBeenLastCalledWith('doubleBonuses', true);
  });

  it('shows a switch that is on as ticked', () => {
    setup({ doubleBonuses: true });
    expect(screen.getByRole('checkbox', { name: /double bonuses/i })).toBeChecked();
  });

  it('says when changes apply, and can go back to the defaults', async () => {
    const { user, onReset } = setup();
    expect(screen.getByText(/apply from the next match/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
