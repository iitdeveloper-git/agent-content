# AGENTS.md — Agent & AI Assistant Guidelines for AgentContent

Welcome, AI Agent or Contributor. This document outlines the operational rules, architecture boundaries, and quality requirements when working inside the **AgentContent** codebase.

---

## 1. Project Mission & Identity

- **Project:** AgentContent
- **Organization:** IITDEVELOPER (`https://github.com/iitdeveloper-git/agent-content`)
- **License:** Apache License 2.0
- **Scope:** `@iitdeveloper/*`
- **Tagline:** Make every website readable by AI agents.

AgentContent provides developer infrastructure for Markdown content negotiation, structured content registry, HTML-to-Markdown conversion, HTTP caching, and deterministic `llms.txt` generation.

---

## 2. Cardinal Architecture Rules

### 2.1 Complete Independence from Growixa
AgentContent is a standalone open-source project. Growixa may consume AgentContent, but AgentContent **must never depend on Growixa**.
- **DO NOT** add Growixa-specific APIs, billing, subscription logic, tenant models, or authentication.
- Keep all functionality generic, standard, and reusable by any developer or company.

### 2.2 Framework Independence in Core
- `@iitdeveloper/agent-content` (in `packages/core`) is strictly framework-independent.
- **DO NOT** import Next.js, Express, React, or browser-specific DOM APIs inside `packages/core`.
- Use Web standard APIs (`Request`, `Response`, `Headers`, `URL`, Web Crypto) and standard Node primitives where needed.

### 2.3 Security by Default
- Always sanitize and validate user paths (prevent path traversal).
- Always validate remote URLs (enforce strict SSRF protection against private IPv4/IPv6, loopbacks, and cloud metadata `169.254.169.254`).
- Never leak unpublished pages, draft routes, or internal stack traces in HTTP responses.
- Enforce request and output size limits to prevent ReDoS and memory exhaustion.

### 2.4 Deterministic Output
- Generation of Markdown, frontmatter, and `llms.txt` must be deterministic.
- Sort keys where appropriate; normalize URLs and whitespace.

### 2.5 Caching & CDN Integrity
- Whenever a response representation is determined by the `Accept` header, emit `Vary: Accept`.
- When an explicit format (`?format=md` or `/page.md`) determines the representation, do not emit `Vary: Accept` so CDNs can cache by URL.
- Always include `X-Content-Type-Options: nosniff`.
- Generate distinct ETags for Markdown versus HTML representations (e.g., prefix `W/"md-..."`).

---

## 3. Monorepo Organization

```
packages/
  core/         # Pure TypeScript engine (negotiation, markdown, registry, discovery, cache, security)
  nextjs/       # Next.js App Router route handlers, helpers, and middleware adapters
  node/         # Express middleware, Node HTTP adapter, Web Fetch adapter
  cli/          # Command-line interface (init, validate, generate-llms)
examples/       # Standalone runnable demonstrations
tests/          # End-to-end integration and security test suites
docs/           # In-depth architectural, integration, and security specifications
```

---

## 4. Coding & Quality Standards

1. **Strict TypeScript:** No implicit `any`, strict null checks, exhaustive switch statements.
2. **Defensive Coding:** Validate all external inputs with schema validation (Zod) and defensive guards.
3. **Tests First / Test Driven:** Every new feature, route handler, and conversion rule must have unit and integration tests.
4. **Documentation Integrity:** Preserve all existing comments and docstrings. Document rationale and edge cases.
5. **No Broken Windows:** Never leave stubs, TODOs without issues, or unhandled promise rejections.

---

## 5. Standard Commands

```bash
# Install dependencies across monorepo
pnpm install

# Build all packages
pnpm build

# Run test suite
pnpm test

# Run type checks
pnpm typecheck

# Run linter
pnpm lint
```

