// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { HeaderMenu, type MenuItem } from './HeaderMenu';

afterEach(() => cleanup());

const items = (onSelect = vi.fn()): MenuItem[] => [
  { id: 'a', label: 'First', onSelect },
  { id: 'b', label: 'Second', onSelect, current: true },
  { id: 'c', label: 'Third', onSelect },
];

const menuButton = () => screen.getByRole('button', { name: /menu/i });

describe('header menu', () => {
  it('starts closed, and opens a list of every item', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu items={items()} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['First', 'Second', 'Third']);
  });

  it('marks the page you are on', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu items={items()} />);
    await user.click(menuButton());
    expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('menuitem', { name: 'First' })).not.toHaveAttribute('aria-current');
  });

  it('runs the item you pick and then closes', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<HeaderMenu items={items(onSelect)} />);
    await user.click(menuButton());
    await user.click(screen.getByRole('menuitem', { name: 'Third' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when the button is pressed again', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu items={items()} />);
    await user.click(menuButton());
    await user.click(menuButton());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when you press anywhere else', async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Somewhere else</p>
        <HeaderMenu items={items()} />
      </>,
    );
    await user.click(menuButton());
    await user.click(screen.getByText('Somewhere else'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stays open when you press inside it, between items', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu items={items()} />);
    await user.click(menuButton());
    await user.click(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('works from the keyboard: starts on the first item, arrows move, Escape closes and returns to the button', async () => {
    const user = userEvent.setup();
    render(<HeaderMenu items={items()} />);
    await user.click(menuButton());
    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Third' })).toHaveFocus(); // wraps round

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(menuButton()).toHaveFocus();
  });
});
