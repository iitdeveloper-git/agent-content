import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';

export const agentContent = defineAgentContent({
  site: {
    name: 'Next.js App Router Documentation',
    url: 'https://docs.example.com',
    description: 'Modern full-stack web application with AgentContent',
  },
  pages: [
    {
      url: '/getting-started',
      title: 'Getting Started with Next.js',
      description: 'Quickstart guide for our Next.js application',
      content: '# Getting Started\n\nLearn how to install and run the project.',
      status: 'published',
      category: 'Guides',
    },
    {
      url: '/api-reference',
      title: 'API Reference',
      description: 'Reference documentation for all endpoints',
      content: '# API Reference\n\nDetailed specifications of available REST endpoints.',
      status: 'published',
      category: 'API',
    },
  ],
});
