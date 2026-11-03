import { describe, expect, it } from 'vitest';
import { defineAgentContent, renderStructuredPageToMarkdown } from '../src/content/index.js';
import { generateLlmsFullTxt, generateLlmsTxt } from '../src/discovery/index.js';
import type { StructuredPage } from '../src/types/index.js';

const SITE = { name: 'S', url: 'https://s.test' };

const page: StructuredPage = {
  url: '/services',
  title: 'Services',
  description: 'What we do',
  content: 'Intro text.',
  sections: [{ title: 'Web', content: '- React\n- Next' }],
  updatedAt: '2026-11-02',
  category: 'Offerings',
  metadata: { audience: 'developers', pricing: { currency: 'USD', from: 100 } },
  structuredData: { '@type': 'Service', name: 'Services' },
};

describe('opt-in metadata / structuredData rendering', () => {
  // Frozen from the pre-change implementation: must never drift while the options are off.
  const LEGACY_OUTPUT =
    '---\n' +
    'title: Services\n' +
    'description: What we do\n' +
    'canonical_url: https://s.test/services\n' +
    'updated_at: 2026-11-02\n' +
    'category: Offerings\n' +
    '---\n\n' +
    'Intro text.\n\n## Web\n\n- React\n- Next\n';

  it('is byte-identical to the legacy output when options are omitted or false', () => {
    expect(renderStructuredPageToMarkdown(page, SITE.url)).toBe(LEGACY_OUTPUT);
    expect(renderStructuredPageToMarkdown(page, SITE.url, {})).toBe(LEGACY_OUTPUT);
    expect(
      renderStructuredPageToMarkdown(page, SITE.url, { includeMetadata: false, includeStructuredData: false })
    ).toBe(LEGACY_OUTPUT);
  });

  it('omits metadata and structured data by default through defineAgentContent', () => {
    const ac = defineAgentContent({ site: SITE, pages: [page] });
    const md = ac.getMarkdown('/services')!;
    expect(md).toBe(LEGACY_OUTPUT);
    expect(md).not.toContain('metadata');
    expect(md).not.toContain('jsonld');
  });

  it('emits metadata as one nested frontmatter key when enabled', () => {
    const md = renderStructuredPageToMarkdown(page, SITE.url, { includeMetadata: true });
    expect(md).toBe(
      '---\n' +
        'title: Services\n' +
        'description: What we do\n' +
        'canonical_url: https://s.test/services\n' +
        'updated_at: 2026-11-02\n' +
        'category: Offerings\n' +
        'metadata:\n' +
        '  audience: developers\n' +
        '  pricing:\n' +
        '    currency: USD\n' +
        '    from: 100\n' +
        '---\n\n' +
        'Intro text.\n\n## Web\n\n- React\n- Next\n'
    );
    expect(md).not.toContain('jsonld');
  });

  it('cannot collide with or duplicate reserved frontmatter keys', () => {
    const md = renderStructuredPageToMarkdown(
      { ...page, metadata: { title: 'EVIL', canonical_url: 'https://evil.test' } },
      SITE.url,
      { includeMetadata: true }
    );
    expect(md.match(/^title:/gm)).toHaveLength(1);
    expect(md.match(/^canonical_url:/gm)).toHaveLength(1);
    expect(md).toContain('title: Services');
    expect(md).toContain('  title: EVIL'); // nested only
  });

  it('emits structured data as a single valid JSON-LD fenced block when enabled', () => {
    const md = renderStructuredPageToMarkdown(page, SITE.url, { includeStructuredData: true });
    expect(md).not.toContain('metadata:');
    expect(md.startsWith(LEGACY_OUTPUT.trimEnd())).toBe(true);
    const blocks = md.match(/```jsonld\n([\s\S]*?)\n```/g)!;
    expect(blocks).toHaveLength(1);
    const json = JSON.parse(/```jsonld\n([\s\S]*?)\n```/.exec(md)![1]!);
    expect(json).toEqual({ '@context': 'https://schema.org', '@type': 'Service', name: 'Services' });
    expect(Object.keys(json)[0]).toBe('@context');
  });

  it('keeps a caller-provided @context and supports @graph', () => {
    const custom = renderStructuredPageToMarkdown(
      { ...page, structuredData: { '@context': 'https://example.test/ctx', '@type': 'Thing' } },
      SITE.url,
      { includeStructuredData: true }
    );
    expect(JSON.parse(/```jsonld\n([\s\S]*?)\n```/.exec(custom)![1]!)['@context']).toBe('https://example.test/ctx');

    const graph = renderStructuredPageToMarkdown(
      { ...page, structuredData: { '@graph': [{ '@type': 'Person', name: 'A' }] } },
      SITE.url,
      { includeStructuredData: true }
    );
    expect(JSON.parse(/```jsonld\n([\s\S]*?)\n```/.exec(graph)![1]!)['@graph']).toHaveLength(1);
  });

  it('cannot break out of the fence or form HTML via structured data strings', () => {
    const md = renderStructuredPageToMarkdown(
      {
        ...page,
        structuredData: { '@type': 'Thing', name: '```\n# injected</script><script>alert(1)</script>&' },
      },
      SITE.url,
      { includeStructuredData: true }
    );
    expect(md.match(/```/g)).toHaveLength(2); // exactly the opening and closing fence
    expect(md).not.toContain('<script>');
    expect(md).not.toContain('# injected\n');
    const parsed = JSON.parse(/```jsonld\n([\s\S]*?)\n```/.exec(md)![1]!);
    expect(parsed.name).toBe('```\n# injected</script><script>alert(1)</script>&'); // value preserved
  });

  it('safely omits invalid structured data and metadata instead of failing', () => {
    const cyclic: Record<string, unknown> = { '@type': 'Thing' };
    cyclic.self = cyclic;
    // Not representable as JSON at all: invalid for both fields.
    const unserializable: unknown[] = [
      cyclic,
      { '@type': 'Thing', fn: () => 1 },
      { '@type': 'Thing', big: 10n },
      { '@type': 'Thing', n: Number.NaN },
      { '@type': 'Thing', inst: new Map() },
      { '@type': 'Thing', blob: 'x'.repeat(70 * 1024) },
      {},
      [],
      'string',
    ];
    for (const value of unserializable) {
      const md = renderStructuredPageToMarkdown(
        { ...page, structuredData: value as Record<string, unknown>, metadata: value as Record<string, unknown> },
        SITE.url,
        { includeMetadata: true, includeStructuredData: true }
      );
      expect(md).toBe(LEGACY_OUTPUT);
    }

    // Valid metadata, but not a meaningful JSON-LD node: only structuredData is dropped.
    for (const value of [{ name: 'no type or graph' }, { '@type': 'Thing', '@context': 42 }]) {
      const md = renderStructuredPageToMarkdown({ ...page, structuredData: value, metadata: undefined }, SITE.url, {
        includeStructuredData: true,
      });
      expect(md).toBe(LEGACY_OUTPUT);
    }
  });

  it('rejects excessively deep structures', () => {
    let deep: Record<string, unknown> = { '@type': 'Thing' };
    for (let i = 0; i < 40; i++) deep = { '@type': 'Thing', child: deep };
    const md = renderStructuredPageToMarkdown({ ...page, structuredData: deep }, SITE.url, { includeStructuredData: true });
    expect(md).toBe(LEGACY_OUTPUT);
  });

  it('keeps a literal "__proto__" key as data without polluting prototypes', () => {
    const md = renderStructuredPageToMarkdown(
      { ...page, metadata: JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}') },
      SITE.url,
      { includeMetadata: true }
    );
    expect(md).toContain('ok: 1');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('serialises Dates inside metadata as ISO strings', () => {
    const md = renderStructuredPageToMarkdown(
      { ...page, metadata: { reviewed: new Date('2026-01-02T03:04:05.000Z') } },
      SITE.url,
      { includeMetadata: true }
    );
    expect(md).toContain('reviewed: 2026-01-02T03:04:05.000Z');
  });

  it('is configured through defineAgentContent({ render }) and applies to getMarkdown', () => {
    const ac = defineAgentContent({
      site: SITE,
      pages: [page],
      render: { includeMetadata: true, includeStructuredData: true },
    });
    const md = ac.getMarkdown('/services')!;
    expect(md).toContain('metadata:');
    expect(md).toContain('```jsonld');
  });

  it('keeps draft pages out of published outputs regardless of the options', () => {
    const draft: StructuredPage = { ...page, url: '/secret', title: 'Secret', status: 'draft' };
    const ac = defineAgentContent({
      site: SITE,
      pages: [page, draft],
      render: { includeMetadata: true, includeStructuredData: true },
    });
    expect(() => ac.getMarkdown('/secret')).toThrow(/not published/);
    const pages = ac.listPages({ status: 'published' });
    expect(pages.map((p) => p.url)).toEqual(['/services']);
    const llms = generateLlmsTxt({ site: SITE, pages: ac.listPages() });
    const full = generateLlmsFullTxt({ site: SITE, pages: ac.listPages() });
    for (const out of [llms, full]) {
      expect(out).not.toContain('Secret');
      expect(out).not.toContain('/secret');
    }
  });
});
