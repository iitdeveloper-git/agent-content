import { describe, expect, it } from 'vitest';
import {
  ContentRegistry,
  defineAgentContent,
  normalizePath,
  renderStructuredPageToMarkdown,
} from '../src/content/index.js';
import { ContentValidationError } from '../src/errors/index.js';

describe('Structured Content API', () => {
  describe('normalizePath', () => {
    it('normalizes various route path inputs', () => {
      expect(normalizePath('/about')).toBe('/about');
      expect(normalizePath('about')).toBe('/about');
      expect(normalizePath('/about/')).toBe('/about');
      expect(normalizePath('/about.md')).toBe('/about');
      expect(normalizePath('/docs/guide.md?ref=123')).toBe('/docs/guide');
      expect(normalizePath('https://example.com/pricing.md')).toBe('/pricing');
      expect(normalizePath('/')).toBe('/');
    });
  });

  describe('renderStructuredPageToMarkdown', () => {
    it('renders page content with frontmatter and sections', () => {
      const page = {
        url: '/architecture',
        title: 'System Architecture',
        description: 'Deep dive into architecture',
        content: 'This document explains the architecture.',
        sections: [
          {
            title: 'Core Engine',
            content: 'The core engine is framework-independent.',
            level: 2,
          },
        ],
        language: 'en',
        tags: ['architecture', 'design'],
      };

      const md = renderStructuredPageToMarkdown(page, 'https://example.com');
      expect(md).toMatch(/^---/);
      expect(md).toContain('title: System Architecture');
      expect(md).toContain('canonical_url: https://example.com/architecture');
      expect(md).toContain('This document explains the architecture.');
      expect(md).toContain('## Core Engine');
      expect(md).toContain('The core engine is framework-independent.');
    });
  });

  describe('ContentRegistry', () => {
    it('registers, gets, and lists pages correctly', () => {
      const registry = new ContentRegistry([
        {
          url: '/intro',
          title: 'Introduction',
          content: 'Welcome',
          category: 'Guides',
          status: 'published',
        },
        {
          url: '/draft-post',
          title: 'Draft Post',
          content: 'Secret draft',
          category: 'Guides',
          status: 'draft',
        },
      ]);

      expect(registry.has('/intro')).toBe(true);
      expect(registry.has('/intro.md')).toBe(true);
      expect(registry.get('/intro')?.title).toBe('Introduction');

      const published = registry.list({ status: 'published' });
      expect(published).toHaveLength(1);
      expect(published[0]?.url).toBe('/intro');
    });

    it('rejects invalid page registration', () => {
      const registry = new ContentRegistry();
      expect(() => {
        // @ts-expect-error testing missing title
        registry.register({ url: '/broken' });
      }).toThrow(ContentValidationError);
    });
  });

  describe('defineAgentContent', () => {
    it('initializes agent content instance and provides getMarkdown', () => {
      const content = defineAgentContent({
        site: {
          name: 'Acme Docs',
          url: 'https://docs.acme.com',
          description: 'Official API Documentation',
        },
        pages: [
          {
            url: '/getting-started',
            title: 'Getting Started',
            description: 'Quickstart guide',
            content: '# Getting Started\n\nRun `npm install`',
            status: 'published',
          },
          {
            url: '/internal-draft',
            title: 'Internal Draft',
            content: 'Unreleased',
            status: 'draft',
          },
        ],
      });

      const md = content.getMarkdown('/getting-started');
      expect(md).toBeDefined();
      expect(md).toContain('title: Getting Started');
      expect(md).toContain('Run `npm install`');

      // Attempting to get draft throws RegistryError (404)
      expect(() => content.getMarkdown('/internal-draft')).toThrow();
    });

    it('validates site configuration schema', () => {
      expect(() => {
        defineAgentContent({
          // @ts-expect-error invalid site URL
          site: { name: 'Invalid', url: 'not-a-valid-url' },
        });
      }).toThrow(ContentValidationError);
    });
  });
});

