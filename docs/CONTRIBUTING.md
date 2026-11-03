# Contributing to AgentContent Documentation & Code

Please see the root [CONTRIBUTING.md](../CONTRIBUTING.md) for full development environment setup, coding guidelines, and pull request procedures.

### Monorepo Structure Quick Reference
- `packages/core` — Framework-agnostic TypeScript core engine.
- `packages/nextjs` — Next.js App Router route handlers.
- `packages/node` — Express and Web Fetch adapters.
- `packages/cli` — Scaffolding, validation, and static site build CLI.
- `docs/` — Architectural and deployment documentation.
- `examples/` — Runnable sample applications.
- `tests/integration/` — End-to-end integration and security test suites.

### Testing Commands
```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

