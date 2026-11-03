# Changelog

All notable changes to **AgentContent** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-03

### Added
- **Core Engine (`@iitdeveloper/agent-content`)**:
  - Framework-independent and Edge-runtime safe (zero Node.js binary dependencies; pure Web Standard TS).
  - HTTP content negotiation parser supporting `Accept: text/markdown`, `?format=md`, and `/page.md`.
  - Quality value evaluation with RFC 9110 compliance (`q=0` exclusion, wildcard handling).
  - High-performance HTML-to-Markdown conversion engine with automated clutter removal (`<script>`, `<style>`, `<nav>`, `<footer>`, banners, tracking tags).
  - Pure TypeScript GitHub Flavored Markdown (GFM) tables, strikethrough, and task list plugins.
  - Resource exhaustion guards: iterative DOM depth capping (protects against stack overflow on deeply nested elements) and table row truncation.
  - Sanitization of dangerous URL schemes (`javascript:`, `vbscript:`, `data:text/html`).
  - First-class Structured Content API with `defineAgentContent` and `ContentRegistry`.
  - YAML frontmatter parser and serializer for structured Markdown pages.
  - RFC-compliant, injection-proof `llms.txt` and `llms-full.txt` discovery generators with deterministic sorting.
  - HTTP representation caching with representation-specific ETags (`W/"md-..."`), conditional GET (`If-None-Match`, `If-Modified-Since`), and dynamic `Vary: Accept` emission.
  - Enterprise SSRF defense: full IANA IPv4 and IPv6 special-purpose ranges, cloud metadata protection, loopback and trailing-dot FQDN protection, DNS resolution to detect private IP hostnames, and hop-by-hop redirect validation.
- **Next.js Adapter (`@iitdeveloper/agent-content-nextjs`)**:
  - Single-package installation with full core functionality re-exported.
  - App Router route handlers (`GET`, `HEAD`) supporting Next.js 14, 15, and 16.
  - Support for synchronous and asynchronous route parameters (`context.params.slug`).
  - Automatic `/api/agent-content` mount prefix stripping with custom `stripPrefix` override.
  - Discovery endpoint handlers for `/llms.txt` and `/llms-full.txt`.
  - Credentialed and fallback request protection (automatic `private` cache).
- **Node.js Adapter (`@iitdeveloper/agent-content-node`)**:
  - Single-package installation with full core functionality re-exported.
  - Express/Connect middleware (`createNodeMiddleware`).
  - Automatic `Vary: Accept` emission on HTML pass-through responses to protect intermediate CDN caches.
  - Vanilla Node `http.IncomingMessage` / `http.ServerResponse` handler.
  - Web Standard Fetch API handler (`createFetchHandler`) for Cloudflare Workers, Hono, Bun, and Deno.
- **CLI Utility (`@iitdeveloper/agent-content-cli`)**:
  - Dual binary entry points: `agent-content` and `agent-content-cli`.
  - `agent-content build` to inspect static websites and compile Markdown representations.
  - Non-destructive execution: rule generation is opt-in (`--generate-rules`) with existence checks requiring `-f, --force` to prevent overwriting existing server configurations.
  - Default exclusion of private directories (`_*`, `admin`, `private`, `404.html`) and honoring of `noindex` robots directives.
  - Per-file error isolation during static site conversion.
  - `agent-content init` supporting JSON and TypeScript templates (`--type json|ts`).
  - `agent-content validate` to verify content registries.
- **Examples**:
  - `examples/basic-node` (Express integration with single-package `@iitdeveloper/agent-content-node`).
  - `examples/nextjs-app-router` (Next.js 14/15/16 App Router integration with single-package `@iitdeveloper/agent-content-nextjs`).
  - `examples/structured-content` (Zero-HTML structured Markdown publishing with `@iitdeveloper/agent-content`).
- **Engineering Documentation**:
  - Architecture, security, getting started, and framework integration guides.
