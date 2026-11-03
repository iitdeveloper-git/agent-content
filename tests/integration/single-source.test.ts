import { describe, expect, it } from 'vitest';
import { defineAgentContent } from '@iitdeveloper/agent-content';
// The real example model: proves the documented pattern, not a copy of it.
import { ITEMS, SITE, getItem } from '../../examples/single-source-of-truth/content/site';
import { toStructuredPage } from '../../examples/single-source-of-truth/content/to-structured-page';

describe('Single Source of Truth — one typed model drives HTML data and Markdown', () => {
  const fromModel = defineAgentContent({ site: SITE, pages: ITEMS.map(toStructuredPage) });

  it('produces the same Markdown as hand-written inline content', () => {
    const inline = defineAgentContent({
      site: SITE,
      pages: [
        {
          url: '/services',
          title: 'Services',
          description: 'Web development, data pipelines and AI integration.',
          content: '',
          sections: [
            {
              title: 'Web development',
              level: 2,
              content: 'Fast, accessible sites built on React and Next.js.\n\n- Design systems\n- Performance budgets\n- SEO',
            },
            { title: 'AI integration', level: 2, content: 'Make your product readable by AI agents.' },
          ],
          category: 'Offerings',
          status: 'published',
          updatedAt: '2026-11-02',
          structuredData: {
            '@type': 'WebPage',
            name: 'Services',
            description: 'Web development, data pipelines and AI integration.',
            dateModified: '2026-11-02',
          },
        },
      ],
    });
    expect(fromModel.getMarkdown('/services')).toBe(inline.getMarkdown('/services'));
  });

  it('derives routes, titles and descriptions from the same source for HTML and Markdown', () => {
    for (const page of fromModel.listPages({ status: 'published' })) {
      const item = getItem(page.url)!;
      expect(page.title).toBe(item.title);
      expect(page.description).toBe(item.summary);
      const md = fromModel.getMarkdown(page.url)!;
      expect(md).toContain(`title: ${item.title}`);
      for (const section of item.sections) expect(md).toContain(`## ${section.heading}`);
    }
  });

  it('lists exactly the published model items (static params stay in sync with the site)', () => {
    const expected = ITEMS.filter((i) => i.status === 'published').map((i) => i.path).sort();
    expect(fromModel.listPages({ status: 'published' }).map((p) => p.url).sort()).toEqual(expected);
    expect(fromModel.listPages({ status: 'draft' }).map((p) => p.url)).toEqual(['/roadmap']);
  });

  it('never serves draft model items', () => {
    expect(() => fromModel.getMarkdown('/roadmap')).toThrow(/not published/);
  });

  it('keeps structured data off unless the config opts in', () => {
    expect(fromModel.getMarkdown('/services')).not.toContain('jsonld');
    const optedIn = defineAgentContent({
      site: SITE,
      pages: ITEMS.map(toStructuredPage),
      render: { includeStructuredData: true },
    });
    expect(optedIn.getMarkdown('/services')).toContain('```jsonld');
  });
});
