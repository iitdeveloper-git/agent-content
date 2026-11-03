# AgentContent Roadmap

Strategic development milestones for the AgentContent ecosystem.

---

## Current Release: v0.1.0 (Foundation & Core Release)
- [x] Pure TypeScript framework-agnostic core (`@iitdeveloper/agent-content`).
- [x] RFC 9110 content negotiation (`Accept: text/markdown`, `.md`, `?format=md`).
- [x] High-performance HTML-to-Markdown engine with automated clutter removal.
- [x] Structured Content API with Zod validation.
- [x] Deterministic `llms.txt` and `llms-full.txt` discovery generators.
- [x] HTTP representation caching with representation-specific ETags (`W/"md-..."`).
- [x] Next.js App Router route handlers (`@iitdeveloper/agent-content-nextjs`).
- [x] Node.js, Express, and Web Fetch adapters (`@iitdeveloper/agent-content-node`).
- [x] Static Website CLI (`@iitdeveloper/agent-content-cli`).
- [x] Universal integration guides (Vanilla HTML, Netlify, Vercel, GitHub Pages, Nginx, Apache, PHP).
- [x] Security controls (Path traversal, SSRF defense, payload limits).
- [x] Monorepo CI/CD workflows and automated tests.

---

## Upcoming Milestones

### v0.2.0 — Extended Framework Adapters
- [ ] Dedicated Fastify plugin (`fastify-agent-content`).
- [ ] Nuxt 3 & Nitro server handler adapter.
- [ ] Astro integration hook (`astro-agent-content`).
- [ ] SvelteKit server route handler.

### v0.3.0 — CMS & Static Site Ecosystem
- [ ] Official WordPress plugin (`agent-content-wp`).
- [ ] Strapi CMS content provider plugin.
- [ ] Hugo and Jekyll post-processing presets.
- [ ] Dynamic sitemap parser for zero-config site discovery.

### v0.4.0 — Semantic Enhancement & Token Optimization
- [ ] Semantic chunking and token counting utilities.
- [ ] Automated code sample extractor and syntax highlighter hints.
- [ ] Graph-based relationship mapper (`llms-graph.json`).
- [ ] Streaming Markdown conversion for multi-megabyte documents.

---

## Contributing to the Roadmap
Ideas and architectural proposals are welcomed via our [Feature Request Template](https://github.com/iitdeveloper-git/agent-content/issues/new?template=feature_request.md).

