# AgentContent v0.1.0 — Re-Review After Fixes & Package Rename

Date: 2026-11-03 · Trees reviewed: `main` @ `fd9c4eb` (§1–§6), `2ef16e8` (§7) and the follow-up fix commit (§8) (clean working tree, in sync with `origin/main`) · Review-only; nothing modified, published or committed by the reviewer.
Supersedes the status columns of [FINAL_REVIEW_REPORT.md](FINAL_REVIEW_REPORT.md) (kept as the historical first-pass record).

## Verdict

# APPROVED WITH CONDITIONS

All P0 findings and the large majority of P1/P2 findings are fixed **and independently re-verified from packed tarballs in clean consumer projects**, including real Next.js 15 and 16 builds. Remaining items are non-architectural. Release is acceptable only after the *blocking conditions* in §4 are met; none requires redesign.

## 1. Re-run results (exact commands)

| Command | Result |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Pass |
| `pnpm vitest run` | **104/104 pass** (was 79); 11 files |
| `pnpm vitest run --coverage --coverage.include='packages/*/src/**'` | Works now (`@vitest/coverage-v8@3.2.7` added). **76.05 % stmts / 73.47 % branch** (was 72.8 / 70.9). `core/security` 70.1 % (was 45.1), `core/negotiation` 90.1, `core/markdown` 86.7, `nextjs` 53.1 (was 42.8), `cli/build.ts` 84.8, **`cli/index.ts` 30.4**, `cli/bin.ts` 0 |
| `pnpm pack` ×4 | Pass; READMEs now included |
| Clean `npm i <single tgz>` per package (core, node, cli, nextjs) | Pass — adapter pulls core automatically (`npm ls`: `agent-content-node → agent-content@0.1.0`) |
| ESM, CJS, `tsc --strict` (`nodenext` + `bundler`) for core and node | Pass; adapter re-exports core (`defineAgentContent`, `htmlToMarkdown` importable from `@iitdeveloper/agent-content-node`) |
| `agent-content`, `agent-content-cli` bins; `npx --no-install @iitdeveloper/agent-content-cli --version` | Pass (0.1.0) |
| **Next.js 16.4.4** and **15.5.28**: `npm i @iitdeveloper/agent-content-nextjs` + README setup, **no** `serverExternalPackages`, then `next build` and `next start` | **Build passes; runtime works** |
| `npm audit` (core) | **2 high (zod) — unchanged** |
| `npm view` for the 4 new names | E404 → names are free; scope ownership still unproven |

## 2. Resolution status of first-pass findings

| ID | Sev | Finding | Status | Evidence |
| --- | --- | --- | --- | --- |
| F-01/S-01 | P0 | CLI overwrote `.htaccess`/`_headers` | **FIXED** | Default off; pre-existing files byte-identical after `build`; with `--generate-rules` they are skipped with a warning; `--force` required to overwrite (verified both) |
| F-02 | P1 | Core fails to bundle in Next | **FIXED** | Next 15.5.28 + 16.4.4 build from tarball without workaround (GFM plugin vendored; `turndown-plugin-gfm` removed from dependencies; tables still convert) |
| F-03 | P1 | Next quickstart non-functional | **FIXED (with caveats)** | With README `route.ts` + `proxy.ts` (16) / `middleware.ts` (15): `/about` + `Accept: text/markdown`, `/about.md` → 200 `text/markdown`, `Vary: …, Accept`, `W/"md-…"`; draft `/secret.md` → 404. Handler resolves via `context.params` / `stripPrefix`. Caveats: N-1, N-2, N-3 below |
| F-04/S-05 | P1 | No `Vary: Accept` on HTML | **FIXED for adapters; open for Next recipe** | Express HTML pass-through now `Vary: Accept` (live curl); core returns `shouldVaryAccept:true` for default; PHP emits Vary. Static Next HTML via the documented `proxy.ts` still has no `Vary: Accept` (N-2) |
| F-05/S-02 | P1 | SSRF deny-list gaps | **FIXED** | `localhost.`, `*.localhost`, `metadata.google.internal`, 192.0.0.0/24, 198.18/15, multicast/broadcast, NAT64, 6to4, `fec0::/10` all blocked; redirect to metadata hostname blocked |
| S-03 | P1 | No DNS resolution / rebinding | **PARTIALLY FIXED** | `resolveAndValidateDns` added and applied to initial URL and each redirect (blocks `127.0.0.1.nip.io`-style). **TOCTOU remains**: stub resolver returning public IP once then 127.0.0.1 → `fetch()` was called with the hostname and the body was returned (no IP pinning). Resolver errors **fail open** (`catch {}` → `safe:true`). README now claims "internal DNS rebinding" protection — overclaim (R-1) |
| S-04/F-14 | P1 | Untested/unused/dead security options | **MOSTLY FIXED** | `ssrfProtection`, `maxOutputSizeBytes`, `allowedPaths`/`isPathAllowed`, adapters' `security` now consumed; 6 `safeFetchUrl` tests. `safeFetchUrl` itself still has **0 call sites** (utility only) |
| F-06 | P1 | Packages unpublished / naming | **RESOLVED for naming; publish pending (by design)** | Consistent `@iitdeveloper/agent-content{,-nextjs,-node,-cli}` in all manifests; single-command installs verified. Stale names remain in docs/examples (R-2). Scope ownership unverified |
| F-07 | P1 | Source untracked | **FIXED** | `fd9c4eb` tracks 103 files; `.venv` ignored and not tracked |
| F-08 | P2 | `init`↔`validate` mismatch | **FIXED** (new minor: R-5) | `init` writes `agent-content.config.json`; `validate` → "✓ valid, 2 pages" |
| F-09/S-06 | P2 | CLI publishes private/non-content | **FIXED** | `_private/`, `admin/`, `404.html`, `noindex` page skipped; summary shows "Pages Skipped" |
| F-10/S-07 | P2 | `llms.txt` injection | **FIXED** | Newline collapsed (`line1 ## Injected` on one line), `[ ]` escaped |
| F-11 | P2 | Markdown content loss | **MOSTLY FIXED** | Multiple `<article>` kept; `<aside>`, `.modal` content kept; `javascript:`/`data:` links → `#`. Remaining: `<h1>` inside `<header>` outside `<main>` still dropped (R-4); articles joined by an escaped `\---` (cosmetic) |
| F-12/S-08 | P2 | Resource exhaustion | **PARTIALLY FIXED** | CLI isolates failing files (warning, exit 0, other pages built). **Library still overflows at ≥5000 nested elements; 100 000-row table now takes 14.6 s** (was 9.1 s) — no element/depth cap (R-3) |
| F-13/S-09 | P2 | zod advisory | **OPEN** | `zod@3.25.76`, 2 high on every install |
| F-15 | P2 | Test gaps | **IMPROVED, not closed** | See §3 |
| F-16 | P2 | PHP ignores q-values | **PARTIALLY FIXED** | `Vary` added; `Accept: text/html;q=1, text/markdown;q=0.5` **still returns Markdown** (core returns HTML) |
| F-17/S-10 | P2 | `public` cache for private content | **FIXED** | Test "defaults to private cache when Cookie or Authorization header is present" |
| F-18 | P2 | Ordering non-determinism | **Not re-verified** | See §5 |
| F-19 | P2 | Unsupported doc claims | **PARTIALLY FIXED** | Fastify/"native WordPress adapter" claims removed; see R-6 |
| F-20 | P2 | Release pipeline | **PARTIALLY FIXED** | `--provenance` and lint/coverage added; still `NPM_TOKEN`, `--frozen-lockfile=false`, `--no-git-checks`, unused `version_bump` input, no smoke-install |
| L-01…L-06 | P3 | Minor | `..` substring check still rejects `/file..md`; POST `/llms.txt` still 200 |

## 3. Test-quality re-assessment

Improved: 25 new tests including F-03 (sync/async params, prefix stripping), `allowedPaths` 403, private cache on `Cookie`/`Authorization`, CLI non-destructive overwrite, SSRF cases, Vary on HTML. Still missing:
- **No test consumes a built/packed artefact.** Tests still alias to `src`; none references `dist`, `npm pack` or a Next build. F-02 and the package rename were caught only by this review's external consumers. CI (`ci.yml`) has no packaging/consumer/Next fixture job.
- No DNS-rebinding/TOCTOU test; `cli/index.ts` (init/validate/generate-llms) 30 % covered; no deep-nesting/large-table limits test.

## 4. Remaining findings

**Blocking before the first publish (conditions):**

- **R-1 (P1→P2 if claim corrected):** DNS rebinding TOCTOU + fail-open resolver in `safeFetchUrl`. Either pin the connection to the validated IP (custom `lookup`/undici `Agent`) and fail closed, **or** delete the README/docs claim of rebinding protection and document the limitation. Add a test using a flipping resolver stub.
- **R-2 (P2):** Stale old names — `examples/nextjs-app-router/app/llms.txt/route.ts` imports `@iitdeveloper/nextjs` (example will not compile); `examples/nextjs-app-router/README.md`, `examples/basic-node/README.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md` still use `@iitdeveloper/{core,nextjs,node,cli}`. Add a CI grep guard and build the examples in CI.
- **R-6 (P2):** Unsupported claims: "~40,000+ tokens → ~1,200 (80–95 % reduction)" has no benchmark (my fixtures: 46–56 % *bytes*); "Hono / Workers" ✅ and "PHP & WordPress" ✅ unverified; "Enterprise Security by Default". README header says Next.js "14, 15 & 16" — 14 is unverified.
- **N-1 (P2):** README `proxy.ts` uses `accept.includes('text/markdown')`: `Accept: text/markdown;q=0, text/html` is rewritten and the handler answers **404 text/plain** (verified on 15 and 16) instead of HTML. Also the recipe ignores `?format=md` (returns HTML) though other docs list it. Recommend a tiny exported helper (`shouldRewriteToMarkdown(request)`) that reuses core negotiation (it is Edge-safe only if core is — see N-4).
- **N-2 (P2):** Documented Next recipe leaves the HTML representation with `Vary: rsc, …, Accept-Encoding` and `Cache-Control: s-maxage=31536000` but no `Vary: Accept`; the recipe should add `Vary: Accept` on `NextResponse.next()` for negotiable routes.
- **N-3 (P3):** Proxy double-prefixes already-prefixed requests (`/api/agent-content/about.md` → 404); exclude the prefix in the matcher.
- **Scope/ownership:** confirm the npm scope `@iitdeveloper` is owned by the org before publishing (`npm view` of all four names is E404, which proves only that the names are free).

**Non-blocking (track as known issues / next minor):**
- R-3 element/depth/row caps and async/worker conversion (stack overflow ≥5000 nesting; 14.6 s for 100k rows).
- R-4 header-outside-main headings dropped; cosmetic `\---` article separator.
- R-5 `generate-llms` default `--out-dir public` fails with ENOENT if the directory does not exist (init→generate-llms flow).
- F-13 zod (upgrade to a patched major or drop).
- PHP adapter should honour q-values; run the shared negotiation vectors.
- Release workflow: trusted publishing instead of `NPM_TOKEN`, frozen lockfile, wire `version_bump`, post-pack smoke install; add `engines` and `sideEffects` to package manifests; `@types/node` is a runtime dependency of the node adapter (move to peer/dev).
- Hosting guides (Netlify/Vercel/Nginx/Apache/GitHub Pages) still unexercised on real hosts; GitHub Pages `.md` → `text/plain` statement unverified.

## 5. Not re-verified in this pass
Node 18/20 runtime, Next 14, Hono/Workers/Bun/Deno, Windows, large-site performance, Linux `readdir` ordering (F-18), real hosting deployments.

## 6. Architecture after the rename (as verified)

```
@iitdeveloper/agent-content          core (cheerio, turndown, yaml, zod; Node-runtime: crypto/Buffer)
@iitdeveloper/agent-content-nextjs   → depends on core, re-exports it, optional peer next >=14
@iitdeveloper/agent-content-node     → depends on core, re-exports it, optional peer express >=4.18
@iitdeveloper/agent-content-cli      → depends on core; bins: agent-content, agent-content-cli
```
Dependencies are `0.1.0` exact after pack (workspace protocol rewritten). Single-command installs are verified. Core remains framework-independent; the adapters' `export *` from core gives the one-package developer experience requested.

---

## 7. Second re-review — `main` @ `2ef16e8`

Verdict at that point: **APPROVED WITH CONDITIONS**. Verified: 112/112 tests; `scripts/verify-tarballs.mjs` passes; real Next.js **14.2.35, 15.5.28 and 16.4.4** apps built from a single `npm i` of the adapter tarball and ran the README recipe correctly (`Accept`, `.md`, `?format=md`, `q=0` → HTML, draft → 404, `/llms.txt`). Fixed since §1–§6: stale package names, Next `q=0`/`?format=md` recipe bug (`shouldRewriteToMarkdown`), resolver errors fail closed, invented token numbers removed, PHP q-values honoured, `version_bump` wired, frozen lockfile, tarball gate in CI. Open items found: (1) `Vary: Accept` never reaches Next HTML responses (static and `force-dynamic`, all three versions); (2) DNS rebinding TOCTOU (stub resolver: public at check, 127.0.0.1 at connect → body returned); (3) npm scope ownership unproven; (4) Edge `middleware.ts` bundles core (116 kB / 174 kB, `dns/promises` warning); (5) parse-stage DoS (20 000 nested `<ul><li>` = 15.7 s; 50 000 nested `<div>` = 26 s); (6) zod advisory; (7) Hono/Workers claim untested; (8) no `engines`/`sideEffects`; (9) `NPM_TOKEN` only; (10) no Next build in CI.

## 8. Resolution of those items (follow-up commit)

| # | Item | Resolution | Evidence |
| --- | --- | --- | --- |
| 1 | `Vary: Accept` on Next HTML | **Cannot be fixed inside the app — documented, snippet removed.** Experiments on 16.4.4 showed `next.config` `headers()` and `NextResponse.next({ headers })` are also overwritten by Next. Docs now state the limitation and the two mitigations (Accept-aware CDN cache key, or `/page.md` URLs): `docs/NEXTJS_INTEGRATION.md`, `docs/CACHING.md`, README, adapter README. `shouldVaryAccept` remains available for CDN configuration. | Reviewer experiments A/B/C; docs diff |
| 2 | DNS rebinding TOCTOU | **FIXED.** `safeFetchUrl` now issues each hop with `node:http(s)` and a pinned `lookup`: one resolution, every address validated, socket connects to the validated address. New test with a flipping resolver and a real local server asserts rejection ("at connect time") and **zero** connections. `docs/SECURITY.md` documents scope/limits (no proxy env vars, injected fetchers, `ssrfProtection:false`). | `security-rebinding.test.ts` |
| 3 | npm scope ownership | **Cannot be done from the repo.** `docs/RELEASING.md` gives the one-time checklist (verify scope, bootstrap token, enable trusted publishing). **Remains a human release gate.** | `docs/RELEASING.md` |
| 4 | Edge middleware weight | **FIXED.** New dependency-free `@iitdeveloper/agent-content-nextjs/proxy` entry (imports only core `/negotiation`). Next 15 `middleware` bundle **116 kB → 34.9 kB**, no `dns/promises` warning. `verify-tarballs` asserts the proxy chunk imports nothing heavy (negative control confirmed it fails when it imports the core root). | verify scripts |
| 5 | Parse-stage DoS | **FIXED.** Linear pre-parse scan rejects nesting > `maxNestingDepth` (512) or > `maxElements` (200 000) in ~0 ms (all three hostile fixtures above now reject instantly); optional-end-tag elements (`<p>`, `<li>`, `<td>`) are not counted so legitimate unclosed markup still converts; unterminated-tag floods are linear. `maxTableRows` configurable; truncation note now renders as emphasis, not escaped asterisks. | 5 new markdown tests |
| 6 | zod advisory | **FIXED.** `zod@^4.6.6` (4.6.7 resolved); `npm audit` on a clean install of the packed core: **0 vulnerabilities** (was 2 high). | audit output |
| 7 | Hono/Workers claim | **Corrected.** README/node docs now say: Node tested (CI 18/20/22); Bun/Deno/Hono expected but untested; Workers need `nodejs_compat`. CHANGELOG no longer claims core is Edge-safe. | docs diff |
| 8 | `engines` / `sideEffects` | **FIXED.** `engines.node >=18.18.0` on all packages, `sideEffects:false` on libraries (not the CLI); `@types/node` moved from runtime `dependencies` to optional peer + dev dependency in the node adapter. | manifests |
| 9 | `NPM_TOKEN` only | **Improved, one human step remains.** Release now packs with pnpm and publishes with `npm publish <tgz> --provenance` on npm ≥ 11.5.1 (OIDC-capable), tags/commits the bump, and runs both consumer verifications. Trusted publisher must be enabled on npmjs.com after the first (token) publish — see `docs/RELEASING.md`. Workflows were YAML-validated but **not executed**. | `release.yml` |
| 10 | No Next build in CI | **FIXED.** `scripts/verify-nextjs.mjs` (real app from packed tarballs, build + start + 10 HTTP assertions) runs in CI as a Next 14/15/16 matrix and in the release workflow. Locally passed on 14, 15 and 16. | script runs |

Also: CLI file ordering now uses ordinal comparison (locale-independent); `llms.txt`/`llms-full.txt` verified order-independent.

### Final local verification of the fix commit
`pnpm typecheck` 0 errors · `pnpm lint` clean · `pnpm build` ok · **123/123 tests**, coverage **79.1 %** (`core/security` 77.7 %) · `verify-tarballs` ✅ (ESM, CJS, TS under nodenext+bundler, `/proxy`, both bins) · `verify-nextjs` ✅ on 14, 15, 16 · packed-core `npm audit`: 0 vulnerabilities.

### Remaining (not code-fixable here)
1. Confirm ownership of the `@iitdeveloper` npm scope and run the one-time publish bootstrap (`docs/RELEASING.md`).
2. Hosting guides (Netlify, Vercel, GitHub Pages, Nginx, Apache) and Bun/Deno/Hono/Workers are still unexercised on real hosts/runtimes; Windows and Node 18/20 runtime results come only from CI once it runs.
3. GitHub Actions workflow changes could only be syntax-validated locally; confirm the first CI run is green (especially the three Next.js matrix jobs and Node 18).
4. Same-URL `Vary: Accept` negotiation on Next.js HTML behind a shared cache needs the CDN-side cache key described in the docs.

**Verdict after fixes: APPROVED** for a first public release of the code, conditional only on the human release gates above (scope ownership, first green CI run).
