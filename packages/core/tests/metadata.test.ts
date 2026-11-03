import { describe, expect, it } from 'vitest';
import {
  extractFrontmatter,
  extractHtmlMetadata,
  serializeWithFrontmatter,
} from '../src/metadata/index.js';

describe('Metadata & Frontmatter', () => {
  it('extracts valid YAML frontmatter and separates content', () => {
    const raw = `---
title: My Page
description: A great page
tags:
  - one
  - two
---

# Page Body

Here is the markdown content.
`;
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(frontmatter.title).toBe('My Page');
    expect(frontmatter.description).toBe('A great page');
    expect(frontmatter.tags).toEqual(['one', 'two']);
    expect(content.trim()).toBe('# Page Body\n\nHere is the markdown content.');
  });

  it('handles documents without frontmatter gracefully', () => {
    const raw = '# Just Markdown\n\nNo frontmatter here.';
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(content).toBe(raw);
  });

  it('handles malformed YAML frontmatter safely', () => {
    const raw = `---
title: [unclosed list
---
# Content`;
    const { frontmatter, content } = extractFrontmatter(raw);
    expect(frontmatter).toEqual({});
    expect(content).toBe(raw);
  });

  it('serializes frontmatter and content cleanly', () => {
    const serialized = serializeWithFrontmatter('# Body Content', {
      title: 'Hello',
      tags: ['alpha', 'beta'],
    });
    expect(serialized).toMatch(/^---/);
    expect(serialized).toContain('title: Hello');
    expect(serialized).toContain('# Body Content');
  });

  it('extracts HTML metadata including OpenGraph and JSON-LD', () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Open Source Guide</title>
          <meta name="description" content="Guide to OSS" />
          <link rel="canonical" href="https://example.com/oss" />
          <meta property="og:title" content="OG Title" />
          <meta property="og:type" content="article" />
          <meta name="twitter:card" content="summary_large_image" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Open Source Guide"
            }
          </script>
        </head>
        <body>
          <h1>Section 1</h1>
          <h2>Subsection 1.1</h2>
        </body>
      </html>
    `;

    const meta = extractHtmlMetadata(html);
    expect(meta.title).toBe('Open Source Guide');
    expect(meta.description).toBe('Guide to OSS');
    expect(meta.canonicalUrl).toBe('https://example.com/oss');
    expect(meta.language).toBe('en');
    expect(meta.og?.title).toBe('OG Title');
    expect(meta.twitter?.card).toBe('summary_large_image');
    expect(meta.headings).toEqual(['Section 1', 'Subsection 1.1']);
    expect(meta.jsonLd).toHaveLength(1);
    expect(meta.jsonLd?.[0]?.headline).toBe('Open Source Guide');
  });
});

