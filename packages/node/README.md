# @iitdeveloper/agent-content-node

> Node.js, Express, and Web Fetch adapter for AgentContent. Single-package installation with full core functionality re-exported.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/iitdeveloper-git/agent-content/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@iitdeveloper/agent-content-node.svg)](https://www.npmjs.com/package/@iitdeveloper/agent-content-node)

---

## ⚡ What is this?

`@iitdeveloper/agent-content-node` is the official Node.js adapter for **AgentContent**. It provides:
- **Express / Connect Middleware:** Intercepts requests negotiating Markdown (`Accept: text/markdown`, `.md`, `?format=md`), returning structured Markdown while passing normal browser HTML requests to your existing routes with correct `Vary: Accept` headers.
- **Web Standard Fetch Handler:** Compatible with modern runtimes (Node 18+, Bun, Deno, Cloudflare Workers, Hono, Fastify).

**Zero extra packages required:** Installing `@iitdeveloper/agent-content-node` automatically includes the complete AgentContent engine and re-exports all core functions (`defineAgentContent`, `htmlToMarkdown`, etc.).

---

## 📦 Installation

```bash
npm install @iitdeveloper/agent-content-node
```

---

## 🚀 Quickstart (Express / Node.js HTTP)

```typescript
import express from 'express';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';

const app = express();

// 1. Define structured content repository
const content = defineAgentContent({
  site: {
    name: 'Acme SaaS',
    url: 'http://localhost:3000',
    description: 'Cloud platform documentation.',
  },
  pages: [
    {
      url: '/pricing',
      title: 'Pricing Plans',
      description: 'Transparent pricing plans',
      content: '# Pricing\n\n- Free Tier: $0\n- Pro Tier: $29/mo',
      status: 'published',
    },
  ],
});

// 2. Mount AgentContent middleware (before human HTML routes)
app.use(createNodeMiddleware({ content }));

// 3. Existing HTML routes for human web browsers
app.get('/pricing', (req, res) => {
  res.send('<h1>Pricing (HTML view for humans)</h1>');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## 🌐 Web Fetch API (Cloudflare Workers, Bun, Deno, Hono)

```typescript
import { defineAgentContent, createFetchHandler } from '@iitdeveloper/agent-content-node';

const content = defineAgentContent({
  site: { name: 'Edge App', url: 'https://example.com' },
  pages: [
    { url: '/docs', title: 'Docs', content: '# Docs', status: 'published' },
  ],
});

const handleAgentRequest = createFetchHandler({ content });

export default {
  fetch(request: Request) {
    return handleAgentRequest(request);
  },
};
```

---

## 📄 License

Apache License 2.0. Copyright (c) IITDEVELOPER.

