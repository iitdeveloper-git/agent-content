import {
  defineAgentContent,
  generateLlmsFullTxt,
  generateLlmsTxt,
} from '@iitdeveloper/agent-content';

// 1. Define structured content repository
const site = defineAgentContent({
  site: {
    name: 'TechCorp Documentation',
    url: 'https://techcorp.example.com',
    description: 'Cloud developer platform and API documentation.',
  },
  pages: [
    {
      url: '/overview',
      title: 'Platform Overview',
      description: 'High-level introduction to TechCorp cloud services.',
      content:
        '# Platform Overview\n\nTechCorp delivers resilient cloud infrastructure and developer primitives.',
      sections: [
        {
          title: 'Key Benefits',
          content: '- High throughput\n- 99.99% uptime SLA\n- Native AI agent support',
          level: 2,
        },
      ],
      tags: ['overview', 'cloud'],
      category: 'Guides',
      status: 'published',
      updatedAt: '2026-11-01',
    },
    {
      url: '/api/authentication',
      title: 'API Authentication',
      description: 'How to authenticate API requests with Bearer tokens.',
      content:
        '# Authentication\n\nAll REST API endpoints require a valid Bearer token in the `Authorization` header.',
      sections: [
        {
          title: 'Example Request',
          content: '```http\nGET /v1/projects HTTP/1.1\nHost: api.techcorp.example.com\nAuthorization: Bearer <API_KEY>\n```',
          level: 2,
        },
      ],
      tags: ['api', 'security'],
      category: 'API Reference',
      status: 'published',
      updatedAt: '2026-11-02',
    },
  ],
});

console.log('=== Rendered Markdown for /overview ===\n');
console.log(site.getMarkdown('/overview'));

console.log('=== Generated llms.txt ===\n');
console.log(
  generateLlmsTxt({
    site: site.config.site,
    pages: site.listPages({ status: 'published' }),
  })
);

console.log('=== Generated llms-full.txt ===\n');
console.log(
  generateLlmsFullTxt({
    site: site.config.site,
    pages: site.listPages({ status: 'published' }),
    maxCharacterLimit: 10000,
  })
);

