import { afterEach, expect, it, vi } from 'vitest';
import { changeDisplayName, getBalance, getDisplayName } from './api';

afterEach(() => vi.unstubAllGlobals());

it('reports a response body interrupted after headers as a network error', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.error(new TypeError('connection closed'));
    },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));

  await expect(getBalance('test-token')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
});

it('reads settings and submits a display name using the account API', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ displayName: 'Ada', cost: 1000, nextChangeAt: null })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ displayName: 'Grace', cost: 1000, nextChangeAt: null, balance: 500, version: 3 })));
  vi.stubGlobal('fetch', fetchMock);

  expect(await getDisplayName('test-token')).toMatchObject({ displayName: 'Ada', cost: 1000 });
  expect(await changeDisplayName('test-token', 'Grace')).toMatchObject({ displayName: 'Grace', balance: 500, version: 3 });
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/me\/display-name$/);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer test-token' } });
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: JSON.stringify({ displayName: 'Grace' }) });
});
