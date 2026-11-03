import { describe, expect, it } from 'vitest';
import {
  createAgentContentHandler,
  createLlmsTxtHandler,
} from '../src/index.js';

describe('Next.js App Router Adapter', () => {
  const contentConfig = {
    site: {
      name: 'Next.js App with AgentContent',
      url: 'https://example.com',
      description: 'An AI-readable Next.js website',
    },
    pages: [
      {
        url: '/about',
        title: 'About Next.js App',
        description: 'About description',
        content: '# About Our App\n\nBuilt with Next.js and AgentContent.',
        status: 'published' as const,
      },
      {
        url: '/docs/intro',
        title: 'Documentation Intro',
        content: '# Intro\n\nWelcome to docs.',
        status: 'published' as const,
      },
    ],
  };

  it('serves Markdown on Accept: text/markdown request', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/about', {
      headers: {
        Accept: 'text/markdown',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('ETag')).toBeDefined();

    const body = await res.text();
    expect(body).toContain('# About Our App');
  });

  it('serves Markdown for /about.md without Vary: Accept', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/about.md');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    // Vary: Accept must NOT be set when URL extension explicitly determined the representation
    expect(res.headers.get('Vary')).toBeNull();
    const body = await res.text();
    expect(body).toContain('About Next.js App');
  });

  it('resolves path from context.params.slug (Next.js 14 sync params) (F-03)', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/api/agent-content/about', {
      headers: { Accept: 'text/markdown' },
    });
    // Context with sync slug params
    const res = await GET(req, { params: { slug: ['about'] } });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('# About Our App');
  });

  it('resolves path from context.params Promise (Next.js 15/16 async params) (F-03)', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/api/agent-content/about.md');
    // Context with Promise params
    const res = await GET(req, { params: Promise.resolve({ slug: ['about.md'] }) });

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('# About Our App');
  });

  it('automatically strips default /api/agent-content prefix (F-03)', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/api/agent-content/about.md');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('# About Our App');
  });

  it('supports custom stripPrefix option (F-03)', async () => {
    const { GET } = createAgentContentHandler({
      content: contentConfig,
      stripPrefix: '/custom-agent',
    });

    const req = new Request('https://example.com/custom-agent/docs/intro.md');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('# Intro');
  });

  it('enforces allowedPaths security option and returns 403 on forbidden path', async () => {
    const { GET } = createAgentContentHandler({
      content: contentConfig,
      security: { allowedPaths: ['/docs'] },
    });

    const req = new Request('https://example.com/about.md');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('defaults to private cache when Cookie or Authorization header is present (S-10)', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/about.md', {
      headers: { Cookie: 'session=secret123' },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(res.headers.get('Cache-Control')).not.toContain('public');
  });

  it('supports HEAD method returning exact headers but empty body', async () => {
    const { HEAD } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/about', {
      headers: { Accept: 'text/markdown' },
    });

    const res = await HEAD(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('ETag')).toBeDefined();

    const body = await res.text();
    expect(body).toBe('');
  });

  it('handles conditional GET and returns 304 with matching ETag', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    // Initial request to get ETag
    const firstReq = new Request('https://example.com/about.md');
    const firstRes = await GET(firstReq);
    const etag = firstRes.headers.get('ETag');
    expect(etag).toBeDefined();

    // Conditional request
    const condReq = new Request('https://example.com/about.md', {
      headers: { 'If-None-Match': etag! },
    });
    const condRes = await GET(condReq);

    expect(condRes.status).toBe(304);
    const body = await condRes.text();
    expect(body).toBe('');
  });

  it('returns 404 with Vary: Accept for non-markdown requests (delegating back to HTML router)', async () => {
    const { GET } = createAgentContentHandler({ content: contentConfig });

    const req = new Request('https://example.com/about', {
      headers: { Accept: 'text/html' },
    });

    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(res.headers.get('Vary')).toBe('Accept');
  });

  it('serves /llms.txt', async () => {
    const { GET } = createLlmsTxtHandler(contentConfig);
    const req = new Request('https://example.com/llms.txt');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    const text = await res.text();
    expect(text).toContain('# Next.js App with AgentContent');
    expect(text).toContain('- [About Next.js App](https://example.com/about)');
  });
});
