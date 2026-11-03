# Releasing AgentContent

Packages: `@iitdeveloper/agent-content`, `@iitdeveloper/agent-content-nextjs`, `@iitdeveloper/agent-content-node`, `@iitdeveloper/agent-content-cli` (versions are kept in lock-step).

## One-time setup (cannot be automated from the repository)

1. **Own the npm scope.** Create or confirm the `@iitdeveloper` organization on npmjs.com and that the publishing account is an owner. `npm view <name>` returning `E404` only proves a *name* is free, not that you own the scope. Verify with `npm access list packages @iitdeveloper` (after login) or by publishing a private dry-run.
2. **Bootstrap token (first publish only).** npm trusted publishing can only be attached to a package that already exists. Create an automation token, store it as the repository secret `NPM_TOKEN`, and run the *Release Packages* workflow once.
3. **Switch to trusted publishing (OIDC).** For each of the four packages: npmjs.com → package → *Settings* → *Trusted Publisher* → GitHub Actions, repository `iitdeveloper-git/agent-content`, workflow `release.yml`. Then delete the `NPM_TOKEN` secret and the `NODE_AUTH_TOKEN` env line in `.github/workflows/release.yml`. Provenance attestations are produced either way (`--provenance`, `id-token: write`).
4. Protect `main` (required CI checks, including the *Next.js 14/15/16 consumer* jobs and the *Single Source of Truth example* job). The release job pushes a version commit and tag to `main`; allow the `github-actions[bot]` to bypass protection for that push, or switch the final step to open a PR.

## Every release

1. CI is green on `main` (matrix Node 20/22 + Next.js 14/15/16 consumer jobs).
2. Update `CHANGELOG.md`.
3. Run *Release Packages* (`workflow_dispatch`) with `version_bump` = `patch|minor|major` (`none` publishes the version already in `package.json`).
   The workflow: frozen-lockfile install → bump all packages → typecheck, lint, tests with coverage, build → `scripts/verify-tarballs.mjs` (ESM, CJS, TypeScript declarations, `/proxy` Edge-safety, CLI bins) → `scripts/verify-nextjs.mjs` for Next 14, 15, 16 → `scripts/verify-example.mjs` → `pnpm pack` → `npm publish <tarball> --access public --provenance` → commit, tag `vX.Y.Z`, push.

## Local pre-flight

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build && pnpm test:coverage
node scripts/verify-tarballs.mjs
NEXT_VERSION=16 node scripts/verify-nextjs.mjs   # also 14 and 15
node scripts/verify-example.mjs                  # builds and serves examples/single-source-of-truth
```
