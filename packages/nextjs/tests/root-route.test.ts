import { describe, expect, it } from 'vitest';
import { createAgentContentHandler } from '../src/index.js';
import { shouldRewriteToMarkdown } from '../src/proxy.js';

/**
 * Regression tests for the root page. With a required catch-all `[...slug]` the route never matched
 * `/api/agent-content`, so `/` could not be served as Markdown. The documented optional catch-all
 * `[[...slug]]` invokes the handler for the root with empty / undefined `slug` params.
 */
describe('root page Markdown routing (optional catch-all [[...slug]])', () => {
  const content = {
    site: { name: 'Root Site', url: 'https://r.test' },
    pages: [
      { url: '/', title: 'Home', content: '# Home body', status: 'published' as const },
      { url: '/services', title: 'Services', content: 'Services body', status: 'published' as const },
      { url: '/docs', title: 'Docs', content: 'Docs body', status: 'published' as const },
      { url: '/secret', title: 'Secret', content: 'SECRETBODY', status: 'draft' as const },
    ],
  };
  const { GET, HEAD } = createAgentContentHandler({ content });
  const API = 'https://r.test/api/agent-content';

  // What Next.js passes for the optional catch-all at the root: {} (or slug undefined), sync or async.
  const rootContexts: Array<[string, unknown]> = [
    ['no context', undefined],
    ['empty params', { params: {} }],
    ['undefined slug', { params: { slug: undefined } }],
    ['async empty params', { params: Promise.resolve({}) }],
    ['empty slug array', { params: { slug: [] } }],
  ];

  for (const [label, ctx] of rootContexts) {
    it(`serves "/" as Markdown via Accept (${label})`, async () => {
      const res = await GET(new Request(API, { headers: { Accept: 'text/markdown' } }), ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      expect(await res.text()).toContain('# Home body');
    });
  }

  it('serves "/" via ?format=md and the trailing-slash form', async () => {
    for (const url of [`${API}?format=md`, `${API}/?format=md`]) {
      const res = await GET(new Request(url), { params: {} });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('# Home body');
    }
  });

  it('serves "/" via /index.md and /.md', async () => {
    for (const [url, slug] of [
      [`${API}/index.md`, ['index.md']],
      [`${API}/.md`, ['.md']],
    ] as const) {
      const res = await GET(new Request(url), { params: { slug: [...slug] } });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      expect(await res.text()).toContain('# Home body');
    }
  });

  it('serves nested index.md and regular pages', async () => {
    const nested = await GET(new Request(`${API}/docs/index.md`), { params: { slug: ['docs', 'index.md'] } });
    expect(nested.status).toBe(200);
    expect(await nested.text()).toContain('Docs body');

    const svc = await GET(new Request(`${API}/services`, { headers: { Accept: 'text/markdown' } }), {
      params: { slug: ['services'] },
    });
    expect(svc.status).toBe(200);
    expect(await svc.text()).toContain('Services body');
  });

  it('answers HEAD for the root without a body', async () => {
    const res = await HEAD(new Request(API, { method: 'HEAD', headers: { Accept: 'text/markdown' } }), { params: {} });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('keeps drafts hidden through the root-capable routes', async () => {
    for (const [url, slug] of [
      [`${API}/secret.md`, ['secret.md']],
      [`${API}/secret/index.md`, ['secret', 'index.md']],
    ] as const) {
      const res = await GET(new Request(url), { params: { slug: [...slug] } });
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('SECRETBODY');
    }
  });
});

describe('proxy rewrite for the root page', () => {
  const req = (url: string, accept?: string) => new Request(url, { headers: accept ? { accept } : {} });

  it('rewrites "/" to the API root for Markdown requests', () => {
    expect(shouldRewriteToMarkdown(req('https://r.test/', 'text/markdown')).rewritePath).toBe('/api/agent-content/');
    expect(shouldRewriteToMarkdown(req('https://r.test/?format=md')).rewritePath).toBe('/api/agent-content/?format=md');
    expect(shouldRewriteToMarkdown(req('https://r.test/index.md')).rewritePath).toBe('/api/agent-content/index.md');
  });

  it('leaves browser requests to "/" alone (HTML)', () => {
    for (const accept of ['text/html,application/xhtml+xml,*/*;q=0.8', '*/*', 'text/markdown;q=0, text/html']) {
      expect(shouldRewriteToMarkdown(req('https://r.test/', accept)).rewrite).toBe(false);
    }
    expect(shouldRewriteToMarkdown(req('https://r.test/')).rewrite).toBe(false);
  });
});
