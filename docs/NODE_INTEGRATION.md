# Node.js & Express Integration Guide

AgentContent provides a single-package adapter for Express, Connect, vanilla Node.js HTTP servers, and modern Web Fetch runtimes (Hono, Cloudflare Workers, Fastify with fetch).

---

## 1. Installation

A Node.js developer needs only one package:

```bash
npm install @iitdeveloper/agent-content-node
```

`@iitdeveloper/agent-content-node` re-exports all core AgentContent utilities (`defineAgentContent`, `htmlToMarkdown`, etc.) for seamless single-package consumption.

---

## 2. Express Integration

The `@iitdeveloper/agent-content-node` middleware intercepts requests only when the client explicitly negotiates Markdown (`Accept: text/markdown`, `.md`, or `?format=md`). All standard browser visits fall through to your normal Express routes, with appropriate `Vary: Accept` headers applied to protect intermediate caches.

```typescript
import express from 'express';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';

const app = express();

const content = defineAgentContent({
  site: {
    name: 'Express App',
    url: 'https://example.com',
  },
  pages: [
    {
      url: '/docs/start',
      title: 'Getting Started',
      content: '# Getting Started\n\nWelcome to our Express app documentation.',
      status: 'published',
    },
  ],
});

// Mount AgentContent middleware before your HTML routes
app.use(createNodeMiddleware({ content }));

// Regular HTML routes for human web browsers
app.get('/docs/start', (req, res) => {
  res.send('<html><body><h1>Getting Started (HTML)</h1></body></html>');
});

app.listen(3000, () => console.log('Listening on port 3000'));
```

---

## 3. Vanilla Node.js `http.createServer`

```typescript
import { createServer } from 'node:http';
import { defineAgentContent, createNodeMiddleware } from '@iitdeveloper/agent-content-node';

const content = defineAgentContent({
  site: { name: 'Vanilla Node App', url: 'https://example.com' },
  pages: [
    { url: '/', title: 'Home', content: '# Welcome', status: 'published' },
  ],
});

const middleware = createNodeMiddleware({ content });

const server = createServer((req, res) => {
  middleware(req, res, () => {
    // Human fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>Standard HTML Website</h1>');
  });
});

server.listen(3000);
```

---

## 4. Web Fetch API (Hono, Cloudflare Workers, Deno, Bun)

> **Runtime support:** `createFetchHandler` only uses `Request`/`Response`, but the core engine imports `node:crypto` and `Buffer`. It is tested on Node.js (CI matrix 18/20/22). Bun, Deno and Hono are expected to work, and Cloudflare Workers requires the `nodejs_compat` compatibility flag; none of these runtimes are covered by automated tests yet.

For modern runtimes utilizing standard `Request` and `Response` objects, use `createFetchHandler`:

```typescript
import { defineAgentContent, createFetchHandler } from '@iitdeveloper/agent-content-node';

const content = defineAgentContent({
  site: { name: 'Edge App', url: 'https://example.com' },
  pages: [
    { url: '/docs', title: 'Docs', content: '# Docs', status: 'published' },
  ],
});

const handleAgentContent = createFetchHandler({ content });

export default {
  async fetch(request: Request): Promise<Response> {
    const agentResponse = await handleAgentContent(request);
    if (agentResponse.status !== 404) {
      return agentResponse;
    }

    return new Response('<html><body><h1>Human View</h1></body></html>', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Vary': 'Accept',
      },
    });
  },
};
```
