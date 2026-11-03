import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { createFetchHandler, createNodeMiddleware } from '../src/index.js';

function createMockReqRes(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}) {
  const req = Object.assign(new EventEmitter(), {
    url: options.url,
    method: options.method ?? 'GET',
    headers: options.headers ?? {},
  }) as unknown as IncomingMessage;

  const resHeaders: Record<string, string> = {};
  let body = '';

  const res = {
    statusCode: 200,
    setHeader: vi.fn((key: string, val: string) => {
      resHeaders[key.toLowerCase()] = val;
    }),
    getHeader: vi.fn((key: string) => resHeaders[key.toLowerCase()]),
    end: vi.fn((chunk?: string) => {
      if (chunk) body += chunk;
    }),
    _getHeaders: () => resHeaders,
    _getBody: () => body,
  } as unknown as ServerResponse & {
    _getHeaders: () => Record<string, string>;
    _getBody: () => string;
  };

  return { req, res };
}

describe('Node.js Adapter', () => {
  const contentConfig = {
    site: {
      name: 'Node Example',
      url: 'https://example.com',
      description: 'Node.js Express App',
    },
    pages: [
      {
        url: '/pricing',
        title: 'Pricing Plans',
        description: 'Affordable pricing',
        content: '# Pricing Plans\n\n- Free tier: $0\n- Pro tier: $29',
        status: 'published' as const,
      },
    ],
  };

  describe('createNodeMiddleware', () => {
    it('serves Markdown for Accept: text/markdown request', async () => {
      const middleware = createNodeMiddleware({ content: contentConfig });
      const { req, res } = createMockReqRes({
        url: '/pricing',
        headers: { accept: 'text/markdown' },
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/markdown; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Accept');
      expect(res._getBody()).toContain('# Pricing Plans');
    });

    it('sets Vary: Accept and passes through to next() for standard HTML requests (S-05)', async () => {
      const middleware = createNodeMiddleware({ content: contentConfig });
      const { req, res } = createMockReqRes({
        url: '/pricing',
        headers: { accept: 'text/html' },
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._getBody()).toBe('');
      // Crucial: Vary: Accept must be set even on HTML pass-through so CDNs don't poison cache
      expect(res.setHeader).toHaveBeenCalledWith('Vary', 'Accept');
    });

    it('enforces allowedPaths and returns 403 when path is not allowed (S-04)', async () => {
      const middleware = createNodeMiddleware({
        content: contentConfig,
        security: { allowedPaths: ['/docs'] },
      });
      const { req, res } = createMockReqRes({
        url: '/pricing.md',
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res._getBody()).toBe('Path not allowed.');
    });

    it('defaults to private cache when Authorization or Cookie header is present (S-10)', async () => {
      const middleware = createNodeMiddleware({ content: contentConfig });
      const { req, res } = createMockReqRes({
        url: '/pricing.md',
        headers: { authorization: 'Bearer secret_token' },
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.statusCode).toBe(200);
      const cacheControl = res._getHeaders()['cache-control'];
      expect(cacheControl).toContain('private');
      expect(cacheControl).not.toContain('public');
    });

    it('serves /llms.txt', async () => {
      const middleware = createNodeMiddleware({ content: contentConfig });
      const { req, res } = createMockReqRes({
        url: '/llms.txt',
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(res._getBody()).toContain('# Node Example');
    });

    it('serves HEAD without body', async () => {
      const middleware = createNodeMiddleware({ content: contentConfig });
      const { req, res } = createMockReqRes({
        url: '/pricing.md',
        method: 'HEAD',
      });
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getBody()).toBe('');
    });
  });

  describe('createFetchHandler', () => {
    it('handles standard Web Fetch Request/Response', async () => {
      const fetchHandler = createFetchHandler({ content: contentConfig });
      const req = new Request('https://example.com/pricing', {
        headers: { Accept: 'text/markdown' },
      });

      const res = await fetchHandler(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
      const text = await res.text();
      expect(text).toContain('# Pricing Plans');
    });

    it('returns 404 with Vary: Accept for HTML requests', async () => {
      const fetchHandler = createFetchHandler({ content: contentConfig });
      const req = new Request('https://example.com/pricing', {
        headers: { Accept: 'text/html' },
      });

      const res = await fetchHandler(req);
      expect(res.status).toBe(404);
      expect(res.headers.get('Vary')).toBe('Accept');
    });
  });
});
