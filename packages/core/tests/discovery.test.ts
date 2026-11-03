import { describe, expect, it } from 'vitest';
import {
  generateLlmsFullTxt,
  generateLlmsTxt,
} from '../src/discovery/index.js';

describe('Discovery — llms.txt & llms-full.txt Generation', () => {
  const sampleSite = {
    name: 'AgentContent Docs',
    url: 'https://agentcontent.dev',
    description: 'Infrastructure for agent-readable websites',
  };

  const samplePages = [
    {
      url: '/introduction',
      title: 'Introduction',
      description: 'Overview of AgentContent',
      content: '# Introduction\n\nAgentContent makes the web readable by AI agents.',
      category: 'Documentation',
      status: 'published' as const,
    },
    {
      url: '/quickstart',
      title: 'Quickstart',
      description: 'Get started in 5 minutes',
      content: '# Quickstart\n\nRun `npm install @iitdeveloper/agent-content`',
      category: 'Documentation',
      status: 'published' as const,
    },
    {
      url: '/api-reference',
      title: 'API Reference',
      description: 'Full TypeScript API',
      content: '# API Reference\n\nExported functions.',
      category: 'Reference',
      status: 'published' as const,
    },
    {
      url: '/unreleased-feature',
      title: 'Secret Draft',
      description: 'Not yet public',
      content: 'Secret',
      category: 'Documentation',
      status: 'draft' as const,
    },
  ];

  describe('generateLlmsTxt', () => {
    it('generates compliant llms.txt format with sections and links', () => {
      const output = generateLlmsTxt({
        site: sampleSite,
        pages: samplePages,
        notes: ['This site supports Accept: text/markdown negotiation.'],
        optionalLinks: [
          {
            title: 'GitHub Repository',
            url: 'https://github.com/iitdeveloper-git/agent-content',
            description: 'Open source codebase',
          },
        ],
      });

      expect(output).toContain('# AgentContent Docs');
      expect(output).toContain('> Infrastructure for agent-readable websites');
      expect(output).toContain('This site supports Accept: text/markdown negotiation.');
      expect(output).toContain('## Documentation');
      expect(output).toContain(
        '- [Introduction](https://agentcontent.dev/introduction): Overview of AgentContent'
      );
      expect(output).toContain(
        '- [Quickstart](https://agentcontent.dev/quickstart): Get started in 5 minutes'
      );
      expect(output).toContain('## Reference');
      expect(output).toContain(
        '- [API Reference](https://agentcontent.dev/api-reference): Full TypeScript API'
      );
      expect(output).toContain('## Optional');
      expect(output).toContain(
        '- [GitHub Repository](https://github.com/iitdeveloper-git/agent-content): Open source codebase'
      );

      // Draft pages must never appear
      expect(output).not.toContain('Secret Draft');
    });

    it('deduplicates duplicate URLs', () => {
      const pagesWithDuplicate = [
        ...samplePages,
        {
          url: '/introduction',
          title: 'Duplicate Intro',
          content: 'Duplicate',
          status: 'published' as const,
        },
      ];

      const output = generateLlmsTxt({
        site: sampleSite,
        pages: pagesWithDuplicate,
      });

      const matches = output.match(/https:\/\/agentcontent\.dev\/introduction/g);
      expect(matches).toHaveLength(1);
    });

    it('sanitizes newline and markdown injection in descriptions and titles (S-07)', () => {
      const maliciousPages = [
        {
          url: '/blog',
          title: 'Blog [Evil](https://evil.test)',
          description: 'Line 1\n## Injected Heading\nLine 2',
          content: '# Blog Content',
          status: 'published' as const,
        },
      ];

      const output = generateLlmsTxt({
        site: sampleSite,
        pages: maliciousPages,
      });

      // Must escape brackets in title so it does not inject nested links
      expect(output).toContain('\\[Evil\\]');
      // Must collapse newlines in description into single spaces
      expect(output).not.toContain('\n## Injected Heading');
      expect(output).toContain('Line 1 ## Injected Heading Line 2');
    });

    it('generates deterministic output sorted by category and url', () => {
      const unsorted = [
        { url: '/z', title: 'Z', content: 'Z', category: 'A', status: 'published' as const },
        { url: '/a', title: 'A', content: 'A', category: 'A', status: 'published' as const },
        { url: '/m', title: 'M', content: 'M', category: 'A', status: 'published' as const },
      ];

      const output1 = generateLlmsTxt({ site: sampleSite, pages: unsorted });
      const output2 = generateLlmsTxt({ site: sampleSite, pages: [...unsorted].reverse() });

      expect(output1).toBe(output2);
      // /a should precede /m which precedes /z
      const posA = output1.indexOf('/a');
      const posM = output1.indexOf('/m');
      const posZ = output1.indexOf('/z');
      expect(posA).toBeLessThan(posM);
      expect(posM).toBeLessThan(posZ);
    });
  });

  describe('generateLlmsFullTxt', () => {
    it('aggregates all published pages with table of contents and delimiters', () => {
      const output = generateLlmsFullTxt({
        site: sampleSite,
        pages: samplePages,
      });

      expect(output).toContain('# AgentContent Docs — Complete Documentation');
      expect(output).toContain('## Table of Contents');
      expect(output).toContain('- [Introduction](https://agentcontent.dev/introduction)');
      expect(output).toContain('- [Quickstart](https://agentcontent.dev/quickstart)');
      expect(output).toContain('<!-- Document: https://agentcontent.dev/introduction -->');
      expect(output).toContain('<!-- Document: https://agentcontent.dev/quickstart -->');
      expect(output).toContain('AgentContent makes the web readable by AI agents.');

      // Draft pages must not be included
      expect(output).not.toContain('Secret Draft');
    });

    it('respects maxCharacterLimit', () => {
      const output = generateLlmsFullTxt({
        site: sampleSite,
        pages: samplePages,
        maxCharacterLimit: 300,
      });

      expect(output).toContain('<!-- Output truncated due to maxCharacterLimit -->');
      expect(output.length).toBeLessThan(800);
    });
  });
});
