import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SSRFError } from '../src/errors/index.js';

/**
 * DNS-rebinding regression (review finding S-03).
 *
 * The resolver used for the pre-flight check (`node:dns/promises`) answers with a PUBLIC address,
 * while the resolver used by the socket at connect time (`node:dns`) answers with 127.0.0.1.
 * A validator that checks the hostname separately from the request that re-resolves it would let
 * the request through; the pinned lookup must refuse to connect.
 */
vi.mock('node:dns/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns/promises')>();
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  return { ...actual, lookup, default: { ...actual, lookup } };
});

vi.mock('node:dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns')>();
  const lookup = (
    _hostname: string,
    _options: unknown,
    callback: (err: Error | null, addresses: Array<{ address: string; family: number }>) => void
  ) => callback(null, [{ address: '127.0.0.1', family: 4 }]);
  return { ...actual, lookup, default: { ...actual, lookup } };
});

describe('safeFetchUrl DNS rebinding (S-03)', () => {
  let server: Server;
  let port: number;
  let hits = 0;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      hits++;
      res.end('INTERNAL-SECRET');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('refuses to connect when the hostname re-resolves to a private address after validation', async () => {
    const { safeFetchUrl } = await import('../src/security/index.js');
    const attempt = safeFetchUrl(`http://rebind.attacker.test:${port}/`);
    await expect(attempt).rejects.toThrow(SSRFError);
    await expect(attempt).rejects.toThrow(/at connect time/);
    expect(hits).toBe(0);
  });
});
