// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LanguageProvider, STORAGE_KEY } from '../i18n';
import { SiteFooter } from './SiteFooter';

const CREDIT =
  'Glagworld characters and concepts originate from the crowdsourced Glaggleland meme community. Images are used for non-commercial fan commentary purposes only.';

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

describe('the footer credit', () => {
  it('says exactly where the characters come from, in British English', () => {
    render(
      <LanguageProvider>
        <SiteFooter />
      </LanguageProvider>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent(CREDIT);
  });

  it('is a footer, the page-level credit that comes last', () => {
    render(
      <LanguageProvider>
        <main>Game</main>
        <SiteFooter />
      </LanguageProvider>,
    );
    const footer = screen.getByRole('contentinfo');
    expect(footer.compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('is translated when the language is Chinese, and keeps the community names', () => {
    window.localStorage.setItem(STORAGE_KEY, 'zh-CN');
    render(
      <LanguageProvider>
        <SiteFooter />
      </LanguageProvider>,
    );
    const text = screen.getByRole('contentinfo').textContent ?? '';
    expect(text).toContain('Glagworld');
    expect(text).toContain('Glaggleland');
    expect(text).toMatch(/非商业/);
    expect(text).not.toContain('Images are used');
  });
});
