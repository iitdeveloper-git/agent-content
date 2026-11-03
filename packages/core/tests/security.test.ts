import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SecurityError, SSRFError } from '../src/errors/index.js';
import {
  isPathAllowed,
  isPrivateIPv4,
  isPrivateIPv6,
  resolveAndValidateDns,
  safeFetchUrl,
  validateAndNormalizePath,
  validateUrlForSSRF,
} from '../src/security/index.js';

describe('Security Controls', () => {
  describe('validateAndNormalizePath', () => {
    it('normalizes valid paths cleanly', () => {
      expect(validateAndNormalizePath('/docs/intro')).toBe('/docs/intro');
      expect(validateAndNormalizePath('docs/intro')).toBe('/docs/intro');
      expect(validateAndNormalizePath('/docs//intro/')).toBe('/docs/intro/');
    });

    it('blocks null bytes (%00 or \\0)', () => {
      expect(() => validateAndNormalizePath('/about\0.md')).toThrow(SecurityError);
      expect(() => validateAndNormalizePath('/about%00.md')).toThrow(SecurityError);
    });

    it('blocks directory traversal attempts (..)', () => {
      expect(() => validateAndNormalizePath('/../../etc/passwd')).toThrow(SecurityError);
      expect(() => validateAndNormalizePath('/docs/../../secret')).toThrow(SecurityError);
      expect(() => validateAndNormalizePath('/%2e%2e/config')).toThrow(SecurityError);
    });
  });

  describe('isPathAllowed', () => {
    it('allows all paths when allowlist is undefined or empty', () => {
      expect(isPathAllowed('/docs/intro')).toBe(true);
      expect(isPathAllowed('/admin', [])).toBe(true);
    });

    it('allows matching path or subpaths in allowlist', () => {
      const allowed = ['/docs', '/blog', '/about'];
      expect(isPathAllowed('/docs', allowed)).toBe(true);
      expect(isPathAllowed('/docs/intro', allowed)).toBe(true);
      expect(isPathAllowed('/about', allowed)).toBe(true);
      expect(isPathAllowed('/admin', allowed)).toBe(false);
      expect(isPathAllowed('/docs-secret', allowed)).toBe(false);
    });
  });

  describe('validateUrlForSSRF — Hostname & IP Filtering (S-02)', () => {
    it('allows valid public HTTPS and HTTP URLs', () => {
      expect(validateUrlForSSRF('https://example.com/api').safe).toBe(true);
      expect(validateUrlForSSRF('https://docs.github.com').safe).toBe(true);
    });

    it('blocks non-HTTP protocols', () => {
      expect(validateUrlForSSRF('ftp://example.com').safe).toBe(false);
      expect(validateUrlForSSRF('file:///etc/passwd').safe).toBe(false);
      expect(validateUrlForSSRF('gopher://127.0.0.1').safe).toBe(false);
      expect(validateUrlForSSRF('data:text/html,test').safe).toBe(false);
    });

    it('blocks localhost, trailing-dot localhost., and RFC 6761 *.localhost', () => {
      expect(validateUrlForSSRF('http://localhost:8080').safe).toBe(false);
      expect(validateUrlForSSRF('http://localhost./').safe).toBe(false);
      expect(validateUrlForSSRF('http://foo.localhost/').safe).toBe(false);
      expect(validateUrlForSSRF('http://127.0.0.1:3000').safe).toBe(false);
      expect(validateUrlForSSRF('http://127.0.1.1').safe).toBe(false);
      expect(validateUrlForSSRF('http://[::1]').safe).toBe(false);
    });

    it('blocks cloud metadata hostnames and internal domains', () => {
      expect(validateUrlForSSRF('http://metadata.google.internal/').safe).toBe(false);
      expect(validateUrlForSSRF('http://instance-data/latest/').safe).toBe(false);
      expect(validateUrlForSSRF('http://server.internal/').safe).toBe(false);
      expect(validateUrlForSSRF('http://printer.local/').safe).toBe(false);
    });

    it('blocks full IANA special-purpose IPv4 ranges', () => {
      // 0.0.0.0/8
      expect(validateUrlForSSRF('http://0.0.0.0').safe).toBe(false);
      // 10.0.0.0/8
      expect(validateUrlForSSRF('http://10.0.0.1').safe).toBe(false);
      // 100.64.0.0/10 (CGNAT)
      expect(validateUrlForSSRF('http://100.64.0.1').safe).toBe(false);
      expect(validateUrlForSSRF('http://100.127.255.254').safe).toBe(false);
      // 127.0.0.0/8
      expect(validateUrlForSSRF('http://127.1.2.3').safe).toBe(false);
      // 169.254.0.0/16
      expect(validateUrlForSSRF('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
      // 172.16.0.0/12
      expect(validateUrlForSSRF('http://172.16.0.5').safe).toBe(false);
      expect(validateUrlForSSRF('http://172.31.255.255').safe).toBe(false);
      // 192.0.0.0/24 (IETF assignments & Oracle cloud metadata 192.0.0.192)
      expect(validateUrlForSSRF('http://192.0.0.1/').safe).toBe(false);
      expect(validateUrlForSSRF('http://192.0.0.192/').safe).toBe(false);
      // 192.0.2.0/24 (TEST-NET-1)
      expect(validateUrlForSSRF('http://192.0.2.1/').safe).toBe(false);
      // 192.168.0.0/16
      expect(validateUrlForSSRF('http://192.168.1.1').safe).toBe(false);
      // 198.18.0.0/15 (Benchmarking)
      expect(validateUrlForSSRF('http://198.18.0.1/').safe).toBe(false);
      expect(validateUrlForSSRF('http://198.19.255.1/').safe).toBe(false);
      // 224.0.0.0/4 (Multicast)
      expect(validateUrlForSSRF('http://224.0.0.1/').safe).toBe(false);
      // 240.0.0.0/4 (Reserved)
      expect(validateUrlForSSRF('http://240.0.0.1/').safe).toBe(false);
      // 255.255.255.255 (Broadcast)
      expect(validateUrlForSSRF('http://255.255.255.255/').safe).toBe(false);
    });

    it('blocks full IANA special-purpose IPv6 ranges', () => {
      // Loopback
      expect(validateUrlForSSRF('http://[::1]').safe).toBe(false);
      // Link-local
      expect(validateUrlForSSRF('http://[fe80::1]').safe).toBe(false);
      // Site-local (deprecated)
      expect(validateUrlForSSRF('http://[fec0::1]').safe).toBe(false);
      // Unique local
      expect(validateUrlForSSRF('http://[fc00::1]').safe).toBe(false);
      expect(validateUrlForSSRF('http://[fd00::1]').safe).toBe(false);
      // IPv4-mapped loopback (dotted)
      expect(validateUrlForSSRF('http://[::ffff:127.0.0.1]').safe).toBe(false);
      // IPv4-mapped loopback (hex format)
      expect(validateUrlForSSRF('http://[::ffff:7f00:1]').safe).toBe(false);
      // NAT64 embedding of loopback
      expect(validateUrlForSSRF('http://[64:ff9b::7f00:1]').safe).toBe(false);
      // 6to4 embedding of loopback
      expect(validateUrlForSSRF('http://[2002:7f00:1::]').safe).toBe(false);
    });

    it('enforces allowedHosts when configured', () => {
      const options = { allowedHosts: ['api.acme.com', 'acme.com'] };
      expect(validateUrlForSSRF('https://api.acme.com/data', options).safe).toBe(true);
      expect(validateUrlForSSRF('https://evil.com/data', options).safe).toBe(false);
    });
  });

  describe('safeFetchUrl (S-04)', () => {
    let mockServer: ReturnType<typeof createServer>;
    let testPort: number;

    beforeAll(async () => {
      mockServer = createServer((req, res) => {
        if (req.url === '/ok') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello from safe mock server');
          return;
        }
        if (req.url === '/oversized') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('A'.repeat(5000));
          return;
        }
        if (req.url === '/redirect-loopback') {
          res.writeHead(302, { Location: 'http://127.0.0.1:8080/secret' });
          res.end();
          return;
        }
        if (req.url === '/redirect-metadata') {
          res.writeHead(302, { Location: 'http://metadata.google.internal/secret' });
          res.end();
          return;
        }
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
          testPort = (mockServer.address() as AddressInfo).port;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    });

    it('blocks immediate SSRF attempt to loopback when ssrfProtection is enabled', async () => {
      await expect(
        safeFetchUrl(`http://127.0.0.1:${testPort}/ok`)
      ).rejects.toThrow(SSRFError);
    });

    it('fetches successfully when ssrfProtection is disabled for internal test', async () => {
      const body = await safeFetchUrl(`http://127.0.0.1:${testPort}/ok`, {
        ssrfProtection: false,
      });
      expect(body).toBe('Hello from safe mock server');
    });

    it('enforces maxOutputSizeBytes limit on response body', async () => {
      await expect(
        safeFetchUrl(`http://127.0.0.1:${testPort}/oversized`, {
          ssrfProtection: false,
          maxOutputSizeBytes: 1000,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('blocks redirects to cloud metadata hostname (hop re-validation)', async () => {
      await expect(
        safeFetchUrl(`http://127.0.0.1:${testPort}/redirect-metadata`, {
          ssrfProtection: true,
          allowedHosts: ['127.0.0.1'], // Even if origin was allowed
        })
      ).rejects.toThrow(SSRFError);
    });

    it('fails closed on failing DNS lookups in resolveAndValidateDns', async () => {
      const result = await resolveAndValidateDns('non-existent-domain-xyz-123456789.invalid');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('DNS resolution failed');
    });

    it('blocks direct loopback IP in resolveAndValidateDns', async () => {
      const result = await resolveAndValidateDns('127.0.0.1');
      expect(result.safe).toBe(false);
      expect(result.reason).toContain('private IPv4 address');
    });
  });
});
