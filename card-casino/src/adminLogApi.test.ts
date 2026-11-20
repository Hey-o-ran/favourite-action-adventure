// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlayerLog, listWinAnnouncements, reportWin, searchLogAccounts } from './api';

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, text: async () => JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('finding an account for the player log', () => {
  it('asks the server for accounts matching the term, with the term encoded', async () => {
    const fetchMock = reply(200, { users: [], truncated: false });
    vi.stubGlobal('fetch', fetchMock);
    await searchLogAccounts('tok', 'ada & co@x.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/admin\/log\/search\?q=ada%20%26%20co%40x\.com$/);
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe('Bearer tok');
  });
});

describe('reading a player log', () => {
  it('asks for one account, newest first, with nothing else when no options are given', async () => {
    const fetchMock = reply(200, { entries: [] });
    vi.stubGlobal('fetch', fetchMock);
    await getPlayerLog('tok', 'u 1');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/admin\/log\/u%201$/);
  });

  it('can ask for one kind of entry and carry on from a page marker', async () => {
    const fetchMock = reply(200, { entries: [], next: 'x' });
    vi.stubGlobal('fetch', fetchMock);
    await getPlayerLog('tok', 'u1', { type: 'win', before: '2026-11-13T10:00:00.000Z#abc' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/v1\/admin\/log\/u1\?/);
    const params = new URL(url).searchParams;
    expect(params.get('type')).toBe('win');
    expect(params.get('before')).toBe('2026-11-13T10:00:00.000Z#abc');
  });
});

describe('big wins', () => {
  it('reports a win with the coins won, and the bet when there is one', async () => {
    const fetchMock = reply(200, { confirmed: true, announced: true });
    vi.stubGlobal('fetch', fetchMock);
    const res = await reportWin('tok', { win: 'royalFlush', prize: 7990, bet: 10 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/me\/wins$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ win: 'royalFlush', prize: 7990, bet: 10 });
    expect(res).toEqual({ confirmed: true, announced: true });
  });

  it('reads the announcements everyone is shown', async () => {
    const fetchMock = reply(200, { announcements: [{ announcementId: 'a', displayName: 'ada', verified: false, win: 'royalFlush', prize: 10, createdAt: 'x' }] });
    vi.stubGlobal('fetch', fetchMock);
    const res = await listWinAnnouncements('tok');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/announcements\?wallet=ranked$/);
    expect(res.announcements[0].displayName).toBe('ada');
  });
});
