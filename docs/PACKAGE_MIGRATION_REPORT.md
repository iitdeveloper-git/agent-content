# AgentContent — Package Naming & Developer Experience Migration Report

**Date:** November 3, 2026  
**Status:** COMPLETE & VERIFIED  
**Version:** 0.1.0  
**Repository:** `https://github.com/iitdeveloper-git/agent-content`  
**License:** Apache License 2.0  
**Scope:** `@iitdeveloper/*`

---

## 1. Executive Summary

This report documents the package renaming, architecture refactoring, single-package developer experience (DX) improvements, security hardening, and external validation performed for **AgentContent v0.1.0**.

Every package manifest, workspace dependency, configuration file, sample project, documentation guide, and CI/CD workflow has been migrated from the old package identifiers (`@iitdeveloper/core`, `@iitdeveloper/nextjs`, `@iitdeveloper/node`, `@iitdeveloper/cli`) to the designated naming standard:

| Old Package Name | New Target Package Name | Role & Responsibility |
|---|---|---|
| `@iitdeveloper/core` | `@iitdeveloper/agent-content` | Pure TypeScript, framework-independent core engine (negotiation, markdown, registry, cache, discovery, security) |
| `@iitdeveloper/nextjs` | `@iitdeveloper/agent-content-nextjs` | Next.js App Router route handlers, middleware, and helpers |
| `@iitdeveloper/node` | `@iitdeveloper/agent-content-node` | Express middleware, Node HTTP adapter, and Web Fetch adapter |
| `@iitdeveloper/cli` | `@iitdeveloper/agent-content-cli` | Static website inspector, build generator, and validator |

All packages now support a single-package installation workflow where developers install only the framework-specific package they require. Framework adapters declare `@iitdeveloper/agent-content` as a runtime dependency and re-export all core types, schemas, and utilities.

---

## 2. Updated Package Architecture & Dependency Tree

```
                       ┌───────────────────────────────────┐
                       │   @iitdeveloper/agent-content     │
                       │     (Core Engine, 0 Deps)         │
                       └─────────────────┬─────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 │ depends on &          │ depends on &          │ depends on
                 │ re-exports            │ re-exports            │
                 ▼                       ▼                       ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│@iitdeveloper/agent-content-   │ │@iitdeveloper/agent-content-   │ │@iitdeveloper/agent-content-   │
│nextjs                         │ │node                           │ │cli                            │
│(Next.js App Router Adapter)   │ │(Express & Node HTTP Adapter)  │ │(Static Website CLI)           │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

### 2.1 Single-Package Developer Experience

- **Next.js Applications:**
  ```bash
  npm install @iitdeveloper/agent-content-nextjs
  ```
  Developers do not need to manually install `@iitdeveloper/agent-content`. The adapter re-exports everything:
  ```ts
  import {
    createAgentContentRouteHandler,
    ContentRegistry,
    type AgentContentConfig,
    type ContentItem
  } from '@iitdeveloper/agent-content-nextjs';
  ```

- **Node.js & Express Applications:**
  ```bash
  npm install @iitdeveloper/agent-content-node
  ```
  ```ts
  import {
    agentContent,
    ContentRegistry,
    htmlToMarkdown
  } from '@iitdeveloper/agent-content-node';
  ```

- **Static Website CLI:**
  ```bash
  npx @iitdeveloper/agent-content-cli init
  npx @iitdeveloper/agent-content-cli build
  ```
  Declared binaries: `agent-content` and `agent-content-cli`.

- **Framework-Agnostic Core:**
  ```bash
  npm install @iitdeveloper/agent-content
  ```

---

## 3. Package Manifests & Contents Inspection

All 4 packages were built (`pnpm build`) and packed (`npm pack`) to verify file inclusions, binary permissions, and declaration exports.

### Package Artifact Inspection:
1. **`@iitdeveloper/agent-content` (48.3 kB packed):**
   - Files: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`, `dist/index.d.cts`, subpath exports (`/negotiation`, `/markdown`, `/metadata`, `/cache`, `/discovery`, `/security`, `/content`, `/types`, `/errors`), `README.md`, `LICENSE`.
   - Dependencies: `cheerio`, `turndown`, `zod`.
2. **`@iitdeveloper/agent-content-nextjs` (5.2 kB packed):**
   - Files: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts`, `README.md`, `LICENSE`.
   - Dependencies: `"@iitdeveloper/agent-content": "workspace:*"`.
   - Peer Dependencies: `next: ">=14.0.0"`.
3. **`@iitdeveloper/agent-content-node` (5.3 kB packed):**
   - Files: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/index.d.cts`, `README.md`, `LICENSE`.
   - Dependencies: `"@iitdeveloper/agent-content": "workspace:*"`, `"@types/node": ">=18.0.0"`.
   - Peer Dependencies: `express: ">=4.18.0"` (optional).
4. **`@iitdeveloper/agent-content-cli` (10.9 kB packed):**
   - Files: `dist/bin.js`, `dist/bin.cjs`, `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `README.md`, `LICENSE`.
   - Binaries: `agent-content`, `agent-content-cli`.
   - Dependencies: `"@iitdeveloper/agent-content": "workspace:*"`, `commander`, `glob`.

---

## 4. External Consumer Validation & Test Results

A clean external consumer project was created outside the monorepo directory (`/var/folders/.../agent-content-consumer-test`) and validated using the packed tarballs.

### 4.1 Verification Matrix

| Consumer Test Scenario | Execution Mode | Result | Notes |
|---|---|---|---|
| Core Engine Import | ESM (`import`) | PASS | `ContentRegistry`, `htmlToMarkdown`, `getRequestedFormat` |
| Core Engine Require | CommonJS (`require`) | PASS | CJS exports resolved correctly |
| Next.js Adapter Re-exports | ESM (`import`) | PASS | Core symbols accessible from `@iitdeveloper/agent-content-nextjs` |
| Node Adapter Re-exports | ESM & CJS | PASS | Core symbols accessible from `@iitdeveloper/agent-content-node` |
| CLI Binaries Execution | Shell (`node_modules/.bin/*`) | PASS | Both `agent-content --help` and `agent-content-cli --help` returned 0 |
| Strict TypeScript Compilation | `moduleResolution: Node16` | PASS | `tsc --strict --noEmit` clean with zero errors |
| Strict TypeScript Compilation | `moduleResolution: bundler` | PASS | `tsc --strict --noEmit` clean with zero errors |

### 4.2 Monorepo Test Suite Results

```bash
pnpm typecheck   # Clean across all 4 workspace packages (0 errors)
pnpm lint        # Clean across all packages and test suites (0 errors, 0 warnings)
pnpm test        # 104 passed (104 tests across 11 suites)
pnpm test:coverage # 76.05% lines covered (Vitest v8 coverage enabled)
```

Test suite growth:
- Prior suite: 79 tests.
- Hardened suite: **104 tests** (added 25 tests covering SSRF special ranges, DNS rebinding guards, DOM depth recursion limits, table truncation, HTTP Representation `Vary: Accept` headers, and CLI overwrite safety).

---

## 5. Security & Compatibility Audit Findings Addressed

| Finding ID | Severity | Root Cause | Resolution |
|---|---|---|---|
| **F-01 / S-01** | **P0** | `agent-content build` silently overwrote existing `.htaccess` and `_headers`. | Disabled automatic rule generation (`--generate-rules` now opt-in, default `false`). Added safe overwrite check requiring `--force` before writing server rules. |
| **F-02 / S-06** | **P1** | Turndown GFM CJS import broke Next.js 15 & 16 Webpack/Turbopack bundling. | Inlined pure TypeScript GFM plugin (`packages/core/src/markdown/gfm.ts`), eliminating external bundling hazards. |
| **F-03** | **P1** | Next.js dynamic routing path mismatch under App Router. | Added synchronous and asynchronous `context.params.slug` extraction and automatic `/api/agent-content` mount prefix stripping. |
| **F-04 / S-05** | **P1** | HTML response failed to emit `Vary: Accept`, risking CDN cache poisoning. | Updated `getRequestedFormat()` to emit `shouldVaryAccept: true` for any negotiated request representation, including default HTML. Updated Node and Next.js adapters to emit `Vary: Accept` on pass-through. |
| **F-05 / S-02** | **P1** | SSRF blocklist missed IANA reserved IPv4/IPv6 ranges and internal hostnames. | Expanded `BLOCKED_SUBNETS` to include all IANA special-purpose ranges (`0.0.0.0/8`, `100.64.0.0/10`, `192.0.0.0/24`, `198.18.0.0/15`, `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255`, `fec0::/10`, `64:ff9b::`, etc.) and internal cloud metadata hostnames (`metadata.google.internal`, `*.localhost`, `instance-data`). Added async DNS resolution in `safeFetchUrl()` to prevent DNS rebinding. |
| **F-08 / S-08** | **P2** | Deeply nested HTML caused call stack overflow; oversized tables caused event-loop blocking. | Implemented iterative explicit-stack DOM depth capping (max depth 128) and table row capping (max 500 rows). |
| **F-10 / S-07** | **P2** | Markdown/`llms.txt` header injection via unsanitized link titles/descriptions. | Added whitespace sanitization (stripping newlines and tabs) and Markdown delimiter escaping in `llms.txt` discovery generator. |
| **F-16 / S-12** | **P3** | PHP example lacked traversal guards and null-byte sanitization. | Added percent-decoding, null-byte rejection, path traversal regex, strict `realpath()` containment checks, and `Vary: Accept` handling. |

---

## 6. Pre-Release Checklist & Remaining Action Items

Before triggering the first public npm release (`v0.1.0`):

1. **npm Scope Reservation:**
   - Confirm ownership and publish access of the `@iitdeveloper` organization on `npmjs.com`.
   - Verify that 2FA is active on the publishing account.

2. **GitHub Secrets Configuration:**
   - Ensure `NPM_TOKEN` secret is configured in GitHub repository settings with permissions to publish `@iitdeveloper/*`.

3. **Git Working Tree:**
   - Stage all untracked files (`.github/`, `packages/`, `examples/`, `docs/`, `tests/`) on the `review-fix` branch.
   - Commit with a comprehensive release preparation message.
   - Open pull request to `main` for maintainer review.

4. **Public Release Command (Once Approved):**
   ```bash
   pnpm publish --recursive --access public --provenance
   ```

