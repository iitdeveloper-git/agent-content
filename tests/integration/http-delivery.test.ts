import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';

describe('Integration — Full HTTP Delivery & Negotiation', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  const agentConfig = defineAgentContent({
    site: {
      name: 'AgentContent Integration Site',
      url: 'https://integration.test',
      description: 'End-to-end integration test site',
    },
    pages: [
      {
        url: '/',
        title: 'Home Page',
        description: 'Welcome home',
        content: '# Welcome to AgentContent\n\nAI agent infrastructure.',
        status: 'published',
      },
      {
        url: '/docs/quickstart',
        title: 'Quickstart Guide',
        description: 'How to install and run',
        content: '# Quickstart\n\n1. Run `pnpm install`\n2. Configure agent-content',
        updatedAt: '2026-11-01T10:00:00Z',
        status: 'published',
      },
      {
        url: '/internal/draft',
        title: 'Secret Draft',
        description: 'Confidential draft',
        content: 'This should never leak.',
        status: 'draft',
      },
    ],
  });

  beforeAll(async () => {
    const middleware = createNodeMiddleware({
      content: agentConfig,
      fallbackHtml: (path) => `<html><body><h1>HTML Fallback for ${path}</h1><p>Human text</p></body></html>`,
    });

    server = createServer((req, res) => {
      // Simulate standard Express middleware flow:
      middleware(req, res, () => {
        // Fallback for human browsers that were not intercepted by AgentContent
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('ETag', 'W/"html-server-render-123"');
        res.end(`<!DOCTYPE html><html><body><h1>Human Browser View</h1><p>Path: ${req.url}</p></body></html>`);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('serves standard HTML to regular human browser requests', async () => {
    const res = await fetch(`${baseUrl}/docs/quickstart`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Human Browser View');
    expect(res.headers.get('ETag')).toBe('W/"html-server-render-123"');
  });

  it('serves Markdown when agent provides Accept: text/markdown header', async () => {
    const res = await fetch(`${baseUrl}/docs/quickstart`, {
      headers: {
        Accept: 'text/markdown',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('ETag')).toMatch(/^W\/"md-/);

    const body = await res.text();
    expect(body).toContain('# Quickstart');
    expect(body).toContain('1. Run `pnpm install`');
  });

  it('serves Markdown for explicit .md extension without Vary: Accept', async () => {
    const res = await fetch(`${baseUrl}/docs/quickstart.md`);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    // Vary: Accept is not required because URI uniquely identifies the representation
    expect(res.headers.get('Vary')).toBeNull();
    const body = await res.text();
    expect(body).toContain('title: Quickstart Guide');
  });

  it('serves Markdown for ?format=md query parameter', async () => {
    const res = await fetch(`${baseUrl}/docs/quickstart?format=md`);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('# Quickstart');
  });

  it('handles HEAD requests by returning identical headers and zero body', async () => {
    const res = await fetch(`${baseUrl}/docs/quickstart`, {
      method: 'HEAD',
      headers: { Accept: 'text/markdown' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('ETag')).toMatch(/^W\/"md-/);
    const body = await res.text();
    expect(body).toBe('');
  });

  it('handles conditional requests with If-None-Match returning 304', async () => {
    const initial = await fetch(`${baseUrl}/docs/quickstart`, {
      headers: { Accept: 'text/markdown' },
    });
    const etag = initial.headers.get('ETag');
    expect(etag).toBeDefined();

    const conditional = await fetch(`${baseUrl}/docs/quickstart`, {
      headers: {
        Accept: 'text/markdown',
        'If-None-Match': etag!,
      },
    });

    expect(conditional.status).toBe(304);
    const body = await conditional.text();
    expect(body).toBe('');
  });

  it('never leaks draft routes', async () => {
    const res = await fetch(`${baseUrl}/internal/draft`, {
      headers: { Accept: 'text/markdown' },
    });

    // Should fall through or return 404
    const text = await res.text();
    expect(text).not.toContain('This should never leak.');
  });

  it('serves /llms.txt discovery file', async () => {
    const res = await fetch(`${baseUrl}/llms.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('# AgentContent Integration Site');
    expect(body).toContain('- [Quickstart Guide]');
  });

  it('serves /llms-full.txt complete documentation', async () => {
    const res = await fetch(`${baseUrl}/llms-full.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('# AgentContent Integration Site — Complete Documentation');
    expect(body).toContain('<!-- Document: https://integration.test/docs/quickstart -->');
  });

  it('blocks path traversal attempts with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/..%2f..%2fetc/passwd`, {
      headers: { Accept: 'text/markdown' },
    });
    expect(res.status).toBe(400);
  });
});

