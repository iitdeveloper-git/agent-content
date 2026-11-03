import { describe, expect, it } from 'vitest';
import { shouldRewriteToMarkdown } from '../src/proxy.js';

const req = (url: string, accept?: string) =>
  new Request(url, { headers: accept ? { accept } : {} });

describe('@iitdeveloper/agent-content-nextjs/proxy (dependency-free entry)', () => {
  it('rewrites Accept: text/markdown', () => {
    const d = shouldRewriteToMarkdown(req('https://x.test/about', 'text/markdown'));
    expect(d.rewrite).toBe(true);
    expect(d.rewritePath).toBe('/api/agent-content/about');
  });

  it('rewrites .md URLs and ?format=md', () => {
    expect(shouldRewriteToMarkdown(req('https://x.test/about.md')).rewrite).toBe(true);
    const q = shouldRewriteToMarkdown(req('https://x.test/about?format=md'));
    expect(q.rewrite).toBe(true);
    expect(q.rewritePath).toBe('/api/agent-content/about?format=md');
  });

  it('does not rewrite browsers, wildcards, or q=0 refusals', () => {
    expect(shouldRewriteToMarkdown(req('https://x.test/a', 'text/html,*/*;q=0.8')).rewrite).toBe(false);
    expect(shouldRewriteToMarkdown(req('https://x.test/a', 'text/markdown;q=0, text/html')).rewrite).toBe(false);
    expect(shouldRewriteToMarkdown(req('https://x.test/a')).rewrite).toBe(false);
  });

  it('reports when the representation depends on Accept', () => {
    expect(shouldRewriteToMarkdown(req('https://x.test/a', 'text/html')).shouldVaryAccept).toBe(true);
    expect(shouldRewriteToMarkdown(req('https://x.test/a.md')).shouldVaryAccept).toBe(false);
  });

  it('honours a custom apiPrefix', () => {
    const d = shouldRewriteToMarkdown(req('https://x.test/a', 'text/markdown'), { apiPrefix: '/md' });
    expect(d.rewritePath).toBe('/md/a');
  });
});
