# AgentContent — Initial Repository Audit

**Date:** 2026-11-03  
**Auditor:** Principal Software Architect & Open-Source Maintainer (IITDEVELOPER)  
**Repository:** `https://github.com/iitdeveloper-git/agent-content`  
**License:** Apache License 2.0  
**Package Scope:** `@iitdeveloper/*`

---

## 1. Executive Summary

AgentContent is an open-source developer infrastructure library and framework adapter suite engineered to make any website cleanly readable by AI agents, LLM applications, and web crawlers. It delivers content negotiation (`Accept: text/markdown`, `.md`, `?format=md`), HTML-to-Markdown conversion, structured content registry, frontmatter metadata extraction, deterministic `llms.txt` and `llms-full.txt` generation, and native HTTP caching.

This audit evaluates the repository at its initial commit state (`4a56bb7`), verifies runtime and platform prerequisites, assesses architectural and security risks, and establishes the blueprint for a production-grade monorepo release.

---

## 2. Environment & Tooling Verification

| Component | Target Requirement | Detected Value | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Operating System** | POSIX / macOS / Linux / Windows | macOS (Darwin 24.x) | Verified | Development host |
| **Node.js** | `>= 18.18.0` (Supports 20 LTS & 22 LTS) | `v22.20.0` | Verified | Modern LTS runtime with native Fetch, Web Streams, crypto |
| **Package Manager** | `pnpm >= 9.x` | `pnpm 12.16.1` | Verified | Installed in user prefix (`~/.npm-global/bin/pnpm`) |
| **TypeScript** | `^5.5.0` | Target `~5.7` / `5.8` | Planned | Strict mode, NodeNext / Bundler module resolution |
| **Git Working Tree** | Clean on `main` branch | Clean | Verified | Commit `4a56bb7` |

---

## 3. Existing Files & Repository Status

Prior to this audit, the repository contained:
- `.git/` — Standard Git directory pointing to `https://github.com/iitdeveloper-git/agent-content` on branch `main`.
- `README.md` — 58-byte placeholder stub (`# agent-content \n github.com/iitdeveloper-git/agent-content`).
- `.kilocode/` — Empty directory created by a local IDE.

**Verdict:** The repository is essentially a greenfield project initialized with a bare README. No legacy code or breaking changes need to be preserved, allowing clean implementation of the pnpm monorepo structure specified in the project blueprint.

---

## 4. Framework & Runtime Compatibility Analysis

### 4.1 Node.js Compatibility
- **Runtimes:** Node.js 18.18+, 20.x, and 22.x.
- **APIs Utilized:** Native `fetch`, `Request`, `Response`, `Headers`, `crypto` (`crypto.subtle` / `crypto.createHash`), and node stream utilities.
- **Module Format:** Dual ESM/CJS or pure modern ESM with explicit exports maps in `package.json`. Given modern Next.js and Node 18+ ecosystem standards, modern dual exports or TypeScript transpilation to ESM + CJS declaration maps ensure maximum interoperability.

### 4.2 Next.js Integration Compatibility
- **Target Versions:** Next.js 14.x, 15.x, and 16.x.
- **Architectural Boundary:** The Next.js integration (`@iitdeveloper/agent-content-nextjs`) must focus on App Router **Route Handlers** (`app/**/route.ts` with `GET` and `HEAD` exports).
- **Middleware Warning:** Avoid CPU-intensive HTML parsing or large Markdown generation inside Edge Middleware. Route Handlers run in Node.js server runtime (or Node runtime in Next.js) where full HTML parsing, caching, and streaming can execute safely without 1MB Edge bundle limits or execution timeouts.
- **Independence:** `@iitdeveloper/agent-content` must **never** import or depend on `next`, `react`, or `@types/react`. It remains 100% framework-agnostic.

### 4.3 Node.js Web Adapters
- Standard `http.IncomingMessage` / `http.ServerResponse` adapter for Express, Connect, and vanilla Node HTTP servers.
- Generic Fetch API Web Adapter (`(req: Request) => Promise<Response>`) for Hono, Cloudflare Workers, Fastify with `@fastify/type-provider-typebox`, Deno, or Bun.

---

## 5. Architectural & Security Threat Modeling

### 5.1 Content Negotiation & CDN Cache Collisions (High Severity)
- **Problem:** If a reverse proxy or CDN (Cloudflare, Fastly, AWS CloudFront, Vercel Edge) caches an HTML response for `/about` and serves it to an agent requesting `Accept: text/markdown`, the agent receives HTML. Conversely, if a CDN caches Markdown for `/about` and serves it to a human browser, the human user sees raw Markdown.
- **Mitigation:**
  1. For requests negotiated purely via `Accept: text/markdown`, responses **must** include `Vary: Accept`.
  2. For deterministic representations (`/about.md` or `/about?format=md`), `Vary: Accept` is omitted to allow CDNs to cache by unique URI.
  3. ETags for Markdown must be distinct from HTML ETags (e.g., prefix `W/"md-<hash>"`).
  4. Documentation must explain CDN Cache Key and surrogate-key configuration.

### 5.2 Server-Side Request Forgery (SSRF) in Remote Fetching (High Severity)
- **Problem:** If AgentContent provides utilities to fetch and convert remote URLs (e.g., proxying a CMS or external site), attackers could target internal network assets (`http://169.254.169.254`, `http://localhost:8080`, `http://10.0.0.1`).
- **Mitigation:**
  1. Default to local structured content and local route handlers; remote fetching is strictly opt-in.
  2. If remote fetching is enabled, enforce strict SSRF guards:
     - Reject private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`).
     - Reject IPv6 loopback (`::1`), link-local (`fe80::/10`), unique local (`fc00::/7`).
     - Only allow `http:` and `https:`.
     - Disable automatic unrestricted redirects (validate each redirect destination).
     - Enforce timeout (default 5000ms) and response body size cap (default 5MB).

### 5.3 Path Traversal & Unauthenticated Page Access (High Severity)
- **Problem:** Requests to `/.md`, `/../../etc/passwd.md`, or requests attempting to read unpublished/private draft routes.
- **Mitigation:**
  1. Path normalization that strips directory traversal sequences (`..`, `.`, duplicate slashes, null bytes).
  2. Strict allowlisting against registered public routes.
  3. Unpublished or private drafts return HTTP 404 (never 403 or detailed leak of existence).

### 5.4 ReDoS & HTML Parsing Resource Exhaustion (Medium Severity)
- **Problem:** Malformed or deeply nested HTML can crash brittle regex-based parsers or consume excessive memory.
- **Mitigation:**
  1. Use Cheerio / htmlparser2 with linear parsing complexity.
  2. Enforce strict input size limits before parsing (e.g., 5MB default).
  3. Strip scripts, styles, iframes, SVGs, and tracking scripts before Markdown serialization.

### 5.5 Information Disclosure in Errors (Medium Severity)
- **Problem:** Emitting stack traces, filesystem paths, or internal server tokens in HTTP responses.
- **Mitigation:**
  1. Standardized HTTP error responses with sanitized messages.
  2. Custom error hierarchy (`AgentContentError`, `ContentNegotiationError`, `RegistryError`, `SSRFError`).

---

## 6. Audit Verdict

The repository is completely clean and ready for immediate monorepo scaffolding. No backward compatibility constraints exist for legacy versions. The target architecture is robust, highly modular, and designed strictly under open-source governance.

