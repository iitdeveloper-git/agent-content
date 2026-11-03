# Getting Started with AgentContent

Learn how to install, configure, and use AgentContent to deliver AI-agent-readable Markdown from your website in under 10 minutes.

---

## 1. Installation

Install only the package appropriate for your stack:

```bash
# Next.js App Router (Single-package: includes core)
npm install @iitdeveloper/agent-content-nextjs

# Node.js / Express (Single-package: includes core)
npm install @iitdeveloper/agent-content-node

# Static website CLI (Universal)
npm install -D @iitdeveloper/agent-content-cli

# Core engine (Universal / Framework-independent)
npm install @iitdeveloper/agent-content
```

---

## 2. Defining Your Content

Create an `agent-content.config.ts` in your project root:

```typescript
import { defineAgentContent } from '@iitdeveloper/agent-content';

export const agentContent = defineAgentContent({
  site: {
    name: 'Acme Developer Hub',
    url: 'https://docs.acme.com',
    description: 'Documentation and developer tools for Acme Cloud.',
  },
  pages: [
    {
      url: '/',
      title: 'Welcome to Acme',
      description: 'Acme platform overview and quickstart.',
      content: '# Welcome to Acme\n\nBuild reliable cloud systems with our open-source APIs.',
      status: 'published',
      category: 'Overview',
    },
    {
      url: '/quickstart',
      title: 'Quickstart Guide',
      description: 'Get up and running in 5 minutes.',
      content: '# Quickstart\n\nRun `npm install @acme/sdk` to get started.',
      status: 'published',
      category: 'Guides',
      updatedAt: '2026-11-01',
    },
  ],
});
```

### Already have your content in a data model or React pages?

Don't copy it into `agent-content.config.ts`. Keep one typed model, render your pages from it, and map it with `pages: items.map(toStructuredPage)`. See the [Single Source of Truth guide](SINGLE_SOURCE_OF_TRUTH.md) and the runnable [`examples/single-source-of-truth`](../examples/single-source-of-truth).

---

## 3. Integrating with Next.js (App Router)

Create a catch-all route handler in `app/api/agent-content/[...slug]/route.ts`:

```typescript
import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createAgentContentHandler({
  content: agentContent,
});
```

And expose your `llms.txt` discovery file at `app/llms.txt/route.ts`:

```typescript
import { createLlmsTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createLlmsTxtHandler(agentContent);
```

---

## 4. Integrating with Node.js / Express

```typescript
import express from 'express';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';
import { agentContent } from './agent-content.config.js';

const app = express();

// AgentContent intercepts Markdown requests and /llms.txt
app.use(createNodeMiddleware({ content: agentContent }));

// Standard HTML routes continue working for human web browsers!
app.get('*', (req, res) => {
  res.send('<html><body><h1>Human Web Page</h1></body></html>');
});

app.listen(3000);
```

---

## 5. Verification

Verify with `curl`:

```bash
# 1. Accept Header Content Negotiation
curl -H "Accept: text/markdown" http://localhost:3000/quickstart

# 2. Path Extension
curl http://localhost:3000/quickstart.md

# 3. Query Parameter
curl http://localhost:3000/quickstart?format=md

# 4. Discovery file
curl http://localhost:3000/llms.txt
```
