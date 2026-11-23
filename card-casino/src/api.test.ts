import { afterEach, expect, it, vi } from 'vitest';
import { getBalance } from './api';

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
