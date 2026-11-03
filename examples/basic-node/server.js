import { createServer } from 'node:http';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';

const content = defineAgentContent({
  site: {
    name: 'Acme SaaS',
    url: 'http://localhost:3000',
    description: 'Enterprise developer productivity platform.',
  },
  pages: [
    {
      url: '/',
      title: 'Home',
      description: 'Acme SaaS homepage',
      content: '# Acme SaaS\n\nDeveloper tools built for the modern cloud era.',
      status: 'published',
    },
    {
      url: '/pricing',
      title: 'Pricing',
      description: 'Pricing plans and limits',
      content: '# Transparent Pricing\n\n- Free Tier: $0/month\n- Pro Tier: $29/month\n- Enterprise: Custom SLA',
      status: 'published',
      updatedAt: '2026-11-01',
    },
  ],
});

const agentMiddleware = createNodeMiddleware({
  content,
});

const server = createServer(async (req, res) => {
  // 1. Pass request through AgentContent middleware
  agentMiddleware(req, res, () => {
    // 2. Fallthrough handler for human web browsers requesting HTML
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`
      <!DOCTYPE html>
      <html lang="en">
        <head><title>Acme SaaS</title></head>
        <body style="font-family: sans-serif; padding: 2rem;">
          <h1>Welcome to Acme SaaS (HTML Browser View)</h1>
          <p>You are viewing this site in a standard human web browser.</p>
          <p>AI agents sending <code>Accept: text/markdown</code> or visiting <code>/pricing.md</code> receive clean Markdown automatically!</p>
          <ul>
            <li><a href="/pricing">Visit /pricing</a></li>
            <li><a href="/pricing.md">View Markdown: /pricing.md</a></li>
            <li><a href="/llms.txt">View Discovery: /llms.txt</a></li>
          </ul>
        </body>
      </html>
    `);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Try:`);
  console.log(`  curl -H "Accept: text/markdown" http://localhost:${PORT}/pricing`);
  console.log(`  curl http://localhost:${PORT}/pricing.md`);
  console.log(`  curl http://localhost:${PORT}/llms.txt`);
});
