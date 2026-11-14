// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, giveCoins, searchUsers } from './api';

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, text: async () => JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('searchUsers', () => {
  it('asks the server for matching players, with the term encoded', async () => {
    const fetchMock = reply(200, { users: [], truncated: false });
    vi.stubGlobal('fetch', fetchMock);
    await searchUsers('tok', 'ada & co@x.com');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/admin\/users\/search\?q=ada%20%26%20co%40x\.com$/);
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe('Bearer tok');
  });
});

describe('giveCoins', () => {
  it('posts the signed amount for the player', async () => {
    const fetchMock = reply(200, { userId: 'u 1', amount: -50, balance: 950, version: 3 });
    vi.stubGlobal('fetch', fetchMock);
    const res = await giveCoins('tok', 'u 1', -50);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/admin\/users\/u%201\/coins$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ amount: -50 });
    expect(res.balance).toBe(950);
  });

  it('passes on the current balance when the amount does not fit', async () => {
    vi.stubGlobal(
      'fetch',
      reply(409, { error: { code: 'BALANCE_OUT_OF_RANGE', message: 'x', details: { balance: 750 } } }),
    );
    const err = await giveCoins('tok', 'u1', -800).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.details).toEqual({ balance: 750 });
  });
});
