# AgentContent v0.1.0 — Open-Source & npm Readiness

Date: 2026-11-03

## 1. Repository state

| Item | Finding |
| --- | --- |
| Git history | One commit (`4a56bb7 Initial commit`). `git ls-files` → **1 file (`README.md`)**; `README.md` is also modified; 20 entries untracked (all sources, CI, LICENSE, docs, examples, lockfile). Nothing to review historically and nothing a CI/release checkout would contain. **Blocker.** |
| Stray files | `.venv/` (Python pip tree, thousands of files) at repo root and **not git-ignored**; adding it would pollute the repo. |
| Implementation report | The "engineering report" referenced in the review brief was not found as a distinct file; `docs/PROJECT_AUDIT.md` and `docs/IMPLEMENTATION_PLAN.md` exist. Its "79 tests" claim was verified; "security controls" claims partly failed (see SECURITY_REVIEW). |
| Reviewer skill file | `.agent/skills/agent-content-reviewer/SKILL.md` does not exist. |

## 2. Licensing and community files

- `LICENSE`: Apache-2.0 text (191 lines); every package manifest declares `Apache-2.0`; tarballs include `LICENSE`. **OK.** No `NOTICE` file (not required).
- Present: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` (+ duplicate `docs/CONTRIBUTING.md`), `SECURITY.md` + `docs/SECURITY.md` (private report address `security@iitdeveloper.com`), issue/PR templates, `CHANGELOG.md` (Keep-a-Changelog header; contents not verified against actual release), `ROADMAP.md`.
- Dependency licences (cheerio MIT, turndown MIT, turndown-plugin-gfm MIT, yaml ISC, zod MIT, commander MIT, picocolors ISC) are Apache-compatible; no automated licence check exists.

## 3. Package metadata and exports

| Check | Result |
| --- | --- |
| Names | `@iitdeveloper/{core,nextjs,node,cli}`; consistent (see COMPATIBILITY_REVIEW §1). `npm view` → E404 for all: not yet published; scope ownership unproven. |
| Descriptions / repository / bugs / homepage | Present on all; root `bugs`/`homepage` set; packages have `repository.directory`. |
| `exports` | Dual ESM/CJS with types; core adds subpath exports (`./negotiation`, `./markdown`, …) — import + `tsc` verified. |
| `files` | `["dist"]`; sourcemaps shipped (143 KB core). |
| **Per-package README** | **Missing** — npm package pages would be empty. |
| `sideEffects` | Not declared → tree-shaking claims unverifiable; no tree-shaking claim made in README. |
| `engines` | Only on the root (private) manifest (`node >=18.18`); **published packages declare no `engines`**. |
| `publishConfig` | None (access passed on CLI). |
| Peer deps | `next >=14.0.0` and `express >=4.18.0`, optional. `>=14` implies support that is untested (14 unverified, 15/16 fail by default). `nextjs`/`node` list `@iitdeveloper/core` as a hard dependency (OK) — consumers installing the README's `pnpm add core nextjs` get a single copy. |
| Runtime `Buffer`/`node:crypto` in core | README says "Universal / Any JS Runtime"; core is **not** Edge-compatible. |
| `packageManager` | `pnpm@12.16.1` pinned; `engines.pnpm >=9` — consistent with CI. |

## 4. Release workflow (`.github/workflows/release.yml`)

- `workflow_dispatch` input `version_bump` is **never used** — no version change, tag, changelog or GitHub release occurs. Re-running publishes the same version.
- Auth via long-lived `secrets.NPM_TOKEN` (`NODE_AUTH_TOKEN`); `permissions: id-token: write` is granted but publish does not use `--provenance` or trusted publishing → no provenance attestation.
- Installs with `--frozen-lockfile=false` (non-reproducible), then `pnpm … publish --no-git-checks` (bypasses clean-tree/branch protection) with no environment protection/approval gate.
- Runs verification (`typecheck`, `test`, `build`) but not lint, packaging checks, audit, or a smoke-install.
- No registry dry run; no check that `workspace:*` is rewritten (it is, verified via `pnpm pack`).
- **Not executed** in this review (no publishing authorised).

## 5. Supply chain

`npm audit` → zod advisory (2 high via core). Lockfile present; `.npmrc` sets `auto-install-peers=true`, `only-built-dependencies=esbuild`. No Dependabot/Renovate, no CodeQL/OSSF Scorecard workflow, no SBOM.

## 6. Unsupported or inaccurate documentation claims

| Claim (location) | Status |
| --- | --- |
| "Next.js 14.x & 15.x" (README table, `NEXTJS_INTEGRATION.md`) | **Unsupported**: builds fail on 15 and 16; 14 untested. |
| README Option A Next quickstart yields a working endpoint | **False** as written (404 / HTML). |
| Docs `middleware.ts` snippet | **Fails** (Edge bundle) and is deprecated in Next 16. |
| "Native adapters for … Fastify … WordPress" (README features) | **No such adapters**; only a Fetch handler and a PHP example. |
| "Hono / Fastify / Workers ✅" | Unverified. |
| "Dynamic `Vary: Accept` … so CDNs never confuse HTML and Markdown" | **False** for the HTML side (F-04). |
| "SSRF protection … request/response size limits … draft route isolation … Enterprise Security by Default" | Partial: SSRF incomplete and unwired; `maxOutputSizeBytes`/`allowedPaths` not implemented. |
| "~40,000+ tokens → ~1,200 tokens (~95 % reduction)", "80 % less" sample, "Clean 5KB / 150KB+" | **Invented numbers** — no benchmark in the repo; my 7-page fixture measured 56 % byte reduction (bytes, not tokens). |
| CLI sample output includes "✓ Hosting rules created: …" | `printBuildReport` never prints that line. |
| "Zero CMS migration — Works with … PHP" / "Static" | Overbroad; static hosting cannot negotiate. |
| `npx @iitdeveloper/cli build …` / `pnpm add @iitdeveloper/…` (README, docs) | Fail today (not published). |
| `init` next steps ("Run `npx agent-content validate`") | Fail: validates JSON only. |
| `--generate-rules` shown as an opt-in flag | It is always on. |
| "Deterministic `llms.txt`" | Deterministic only for identical input order (F-18). |
| CI badge | Points at a workflow in a repo whose files are not committed. |

## 7. Readiness checklist

| Gate | Status |
| --- | --- |
| Source committed and reviewable | ❌ |
| Builds from clean checkout | ✅ (local, un-committed tree) |
| Tests green | ✅ 79/79 |
| Coverage tooling working / thresholds | ❌ |
| Install from npm works | ❌ (unpublished) |
| Install from tarball works | ✅ |
| Primary integration (Next.js) works | ❌ |
| No known destructive behaviour | ❌ (S-01) |
| Security claims substantiated | ❌ |
| Docs match behaviour | ❌ |
| Per-package READMEs | ❌ |
| Trusted publishing / provenance | ❌ |
| License | ✅ |

**Readiness: not ready.** See FINAL_REVIEW_REPORT §10–11 for the fix order and re-review criteria.
