// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CardAppearance } from './CardAppearance';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

it('applies both choices and restores them after reopening', () => {
  const first = render(<CardAppearance visible />);
  fireEvent.change(screen.getByLabelText('Card front'), { target: { value: 'ivory' } });
  fireEvent.change(screen.getByLabelText('Card back'), { target: { value: 'green' } });
  expect(document.documentElement.dataset.cardFace).toBe('ivory');
  expect(document.documentElement.dataset.cardBack).toBe('green');
  first.unmount();
  render(<CardAppearance visible />);
  expect(screen.getByLabelText('Card front')).toHaveValue('ivory');
  expect(screen.getByLabelText('Card back')).toHaveValue('green');
});

it('falls back safely when saved data is invalid', () => {
  localStorage.setItem('card-casino.card-appearance', '{bad');
  render(<CardAppearance visible />);
  expect(screen.getByLabelText('Card front')).toHaveValue('classic');
  expect(screen.getByLabelText('Card back')).toHaveValue('blue');
});
