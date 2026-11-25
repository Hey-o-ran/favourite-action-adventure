// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LanguageProvider, STORAGE_KEY } from './i18n';
import { Rules } from './components/Rules';
import { NO_FILTERS } from './gameFilters';

function renderRules(id: string, lang?: 'zh-CN') {
  if (lang) window.localStorage.setItem(STORAGE_KEY, lang);
  return render(
    <LanguageProvider>
      <Rules games={[]} gameId={id} onSelect={() => {}} filters={NO_FILTERS} onFiltersChange={() => {}} sort="default" onSortChange={() => {}} />
    </LanguageProvider>,
  );
}

const rowsOf = (container: HTMLElement) => [...container.querySelectorAll('table.rulestable')].map((t) => t.querySelectorAll('tbody tr').length);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('the Landlord and Shengji tables', () => {
  it('Landlord lists what you can play, then the multiplier and score', () => {
    const { container } = renderRules('landlord');
    expect(rowsOf(container)).toEqual([9, 6]);
    expect(container.textContent).toContain('Run of pairs');
    expect(container.textContent).toContain('Both jokers');
  });

  it('Shengji lists the trump order, the levels and what a win pays', () => {
    const { container } = renderRules('shengji');
    expect(rowsOf(container)).toEqual([5, 7, 3]);
    expect(container.textContent).toContain('Big joker');
    expect(container.textContent).toContain('200 or more');
  });

  it.each(['landlord', 'shengji'])('the %s tables have no English left in Chinese', (id) => {
    const { container } = renderRules(id, 'zh-CN');
    const tables = [...container.querySelectorAll('table.rulestable')];
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) expect(table.textContent?.match(/[A-Za-z]{2,}/)?.[0], table.textContent ?? '').toBeUndefined();
  });
});
