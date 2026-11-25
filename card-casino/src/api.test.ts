import { afterEach, expect, it, vi } from 'vitest';
import { dismissPlayerUpdate, getBalance, getPlayerUpdate } from './api';

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

it('fetches the player update and dismisses the encoded version with authentication', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ update: { version: 'v/1', message: 'Hello' } })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getPlayerUpdate('test-token')).toEqual({ update: { version: 'v/1', message: 'Hello' } });
  await dismissPlayerUpdate('test-token', 'v/1');
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/v1\/me\/update$/);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { authorization: 'Bearer test-token' } });
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/v1\/me\/update\/v%2F1\/dismiss$/);
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { authorization: 'Bearer test-token' } });
});
