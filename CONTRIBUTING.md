# Contributing to AgentContent

Thank you for your interest in contributing to **AgentContent**! We are committed to building high-quality, secure, and developer-friendly infrastructure to make the web readable by AI agents.

---

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Development Setup

### Prerequisites
- **Node.js:** `>= 18.18.0` (Recommended: Node 20 or 22 LTS)
- **Package Manager:** `pnpm >= 9.0.0`
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/iitdeveloper-git/agent-content.git
cd agent-content

# Install monorepo dependencies
pnpm install

# Build all packages
pnpm build

# Run test suite
pnpm test
```

---

## Monorepo Architecture

- `packages/core` — Core TypeScript engine: HTTP negotiation, Markdown conversion, registry, discovery, caching, security.
- `packages/nextjs` — Next.js App Router route handlers and adapter helpers.
- `packages/node` — Express/Connect middleware, Node HTTP adapter, and Web Fetch API handlers.
- `packages/cli` — CLI utility for initializing configurations, validating structured content, and generating static `llms.txt`.
- `examples/` — Runnable sample applications demonstrating integration patterns.

---

## Contribution Guidelines

1. **Architecture Boundaries:**
   - `@iitdeveloper/agent-content` (Core) must **never** import framework-specific packages (Next.js, Express, React).
   - AgentContent must **never** depend on Growixa or any proprietary commercial platform.
2. **Strict TypeScript:**
   - No `any` types unless strictly necessary and documented with an architectural rationale.
   - All public functions must have explicit return types and JSDoc comments.
3. **Test-Driven:**
   - Every bug fix or feature addition must include unit and/or integration tests.
4. **Security First:**
   - Review any input-handling code for path traversal, SSRF, or data leakage risks.

---

## Pull Request Process

1. Create a descriptive feature branch from `main` (e.g., `feat/content-negotiation-wildcard` or `fix/etags-formatting`).
2. Run validation checks locally:
   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```
3. Ensure all tests pass.
4. Open a pull request using our Pull Request Template. Maintainers will review your submission promptly.

