# @iitdeveloper/agent-content

> Framework-independent developer infrastructure to make any website readable by AI agents and LLM applications.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/iitdeveloper-git/agent-content/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@iitdeveloper/agent-content.svg)](https://www.npmjs.com/package/@iitdeveloper/agent-content)

---

## ⚡ What is AgentContent?

AgentContent solves a fundamental problem of the agentic web: **Websites are built for human eyes and browsers, not AI agents.**

When an AI agent (like ChatGPT, Claude, Perplexity, or custom autonomous agents) visits a website, fetching raw HTML wastes massive token context on headers, navbars, footers, scripts, and CSS.

`@iitdeveloper/agent-content` is the **core, framework-independent TypeScript engine** that powers:
1. **HTTP Markdown Content Negotiation:** Evaluates `Accept: text/markdown`, `.md` extensions, and `?format=md`.
2. **HTML-to-Markdown Conversion:** Strips boilerplate, navigations, and scripts, producing clean, structured Markdown with optional YAML frontmatter.
3. **Deterministic `llms.txt` Discovery:** Generates RFC-compliant `llms.txt` and `llms-full.txt` discovery manifests.
4. **HTTP Caching & CDN Integrity:** Emits `Vary: Accept`, representation-specific `W/"md-..."` ETags, and standard `Cache-Control`.
5. **Security by Default:** Comprehensive SSRF defense, path traversal prevention, and resource exhaustion guards.

---

## 📦 Installation

```bash
npm install @iitdeveloper/agent-content
```

*(If you are building with Next.js or Node.js/Express, you can directly install `@iitdeveloper/agent-content-nextjs` or `@iitdeveloper/agent-content-node` without needing to install this core package separately).*

---

## 🚀 Quickstart

```typescript
import { defineAgentContent, htmlToMarkdown, generateLlmsTxt } from '@iitdeveloper/agent-content';

// 1. Define structured content repository
export const content = defineAgentContent({
  site: {
    name: 'Acme Developer Hub',
    url: 'https://docs.acme.com',
    description: 'Documentation for Acme cloud services.',
  },
  pages: [
    {
      url: '/getting-started',
      title: 'Getting Started',
      description: 'Quickstart guide for Acme Cloud',
      content: '# Getting Started\n\nWelcome to Acme Cloud SDK.',
      status: 'published',
      category: 'Guides',
    },
    {
      url: '/api-reference',
      title: 'API Reference',
      description: 'Complete REST and SDK reference',
      content: '# API Reference\n\nAll available endpoints.',
      status: 'published',
      category: 'API',
    },
  ],
});

// 2. Retrieve page Markdown directly
const markdown = content.getMarkdown('/getting-started');

// 3. Generate llms.txt discovery file
const llmsTxt = generateLlmsTxt({
  site: content.config.site,
  pages: content.listPages({ status: 'published' }),
});
```

---

## 🛡️ HTML to Markdown Conversion

```typescript
import { htmlToMarkdown } from '@iitdeveloper/agent-content';

const html = `
  <html>
    <body>
      <nav><a href="/">Home</a></nav>
      <main>
        <h1>Article Title</h1>
        <p>This is clean content for LLM agents.</p>
      </main>
    </body>
  </html>
`;

const markdown = htmlToMarkdown(html, {
  includeFrontmatter: true,
  baseUrl: 'https://acme.com',
});
```

---

## 📄 License

Apache License 2.0. Copyright (c) IITDEVELOPER.

