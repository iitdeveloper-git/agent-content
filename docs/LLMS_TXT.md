# llms.txt & llms-full.txt Discovery Guide

AgentContent includes built-in generation for `llms.txt` and `llms-full.txt` according to the emerging [llmstxt.org](https://llmstxt.org) standard.

---

## 1. What is `llms.txt`?

Similar to `robots.txt` for search engine spiders and `sitemap.xml` for indexers, `llms.txt` is a curated Markdown document designed specifically for AI models, LLMs, and agentic crawlers. It informs AI agents what the website is about and points them to key documentation pages.

---

## 2. Structure of `llms.txt`

A generated `llms.txt` looks like this:

```markdown
# Acme Developer Hub
> Cloud developer platform and API documentation.

This site supports Accept: text/markdown content negotiation.

## Documentation
- [Platform Overview](https://docs.acme.com/overview): High-level introduction to Acme.
- [Quickstart Guide](https://docs.acme.com/quickstart): Get up and running in 5 minutes.

## API Reference
- [Authentication](https://docs.acme.com/api/auth): How to obtain and pass Bearer tokens.

## Optional
- [GitHub Repository](https://github.com/acme/sdk): Open source SDK.
```

---

## 3. Structure of `llms-full.txt`

`llms-full.txt` aggregates the full Markdown content of all public pages into a single document:

```markdown
# Acme Developer Hub — Complete Documentation
> Cloud developer platform and API documentation.

## Table of Contents
- [Platform Overview](https://docs.acme.com/overview)
- [Quickstart Guide](https://docs.acme.com/quickstart)

---

<!-- Document: https://docs.acme.com/overview -->
# Platform Overview
...

---

<!-- Document: https://docs.acme.com/quickstart -->
# Quickstart Guide
...
```

---

## 4. Programmatic Generation

```ts
import { generateLlmsTxt, generateLlmsFullTxt } from '@iitdeveloper/core';
import { content } from './agent-content.config';

const txt = generateLlmsTxt({
  site: content.config.site,
  pages: content.listPages({ status: 'published' }),
});

const fullTxt = generateLlmsFullTxt({
  site: content.config.site,
  pages: content.listPages({ status: 'published' }),
  maxCharacterLimit: 500_000,
});
```

Or statically via the CLI:
```bash
npx agent-content generate-llms --out-dir ./public
```

