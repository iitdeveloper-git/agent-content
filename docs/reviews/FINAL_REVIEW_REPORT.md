# AgentContent v0.1.0 — Independent Release Gate Review (Final Report)

> **Status update (2026-11-03, after fixes and package rename):** this document is the *first-pass* record (package names in it, e.g. `@iitdeveloper/core`, are the pre-rename names). The re-review of `main@fd9c4eb` is in [RE_REVIEW_PACKAGE_RENAME.md](RE_REVIEW_PACKAGE_RENAME.md): verdict **APPROVED WITH CONDITIONS**; P0 and most P1/P2 findings are fixed and re-verified.

- **Reviewer role:** Independent Principal Architect / Security Reviewer (review-only; no implementation files modified)
- **Date:** 2026-11-03
- **Environment:** macOS (Darwin 24.3, arm64), Node v22.20.0, pnpm 12.16.1, npm (registry reachable), PHP (Homebrew), Next.js 15.5.28 and 16.4.4
- **Companion reports:** [ARCHITECTURE_REVIEW](ARCHITECTURE_REVIEW.md) · [SECURITY_REVIEW](SECURITY_REVIEW.md) · [COMPATIBILITY_REVIEW](COMPATIBILITY_REVIEW.md) · [TEST_QUALITY_REVIEW](TEST_QUALITY_REVIEW.md) · [OPEN_SOURCE_READINESS](OPEN_SOURCE_READINESS.md)
- **Method note:** `.agent/skills/agent-content-reviewer/SKILL.md` does not exist in the repository; the reviewer specification pasted into the session was used instead. Scratch fixtures live outside the repo (session scratchpad); nothing was published, released or committed.

---

## 1. Overall Engineering Verdict

# CHANGES REQUIRED

The core engine is well-structured and its happy paths work (negotiation, Express adapter, Fetch handler, CJS/ESM/TypeScript consumption, tarball install, CLI binary). However the release **cannot ship as described** because:

1. **The headline integration (Next.js App Router) does not build** on Next 15 or 16 as shipped, and the README quickstart does not produce a working endpoint even after the build is worked around (F-02, F-03).
2. **The CLI's default behaviour silently overwrites the user's existing `.htaccess` and `_headers`** (F-01) and publishes non-content/private pages into `llms.txt` (F-09).
3. **The `Vary: Accept` / CDN-integrity guarantee, a headline claim and a cardinal rule in `AGENTS.md` §2.5, is violated on the HTML side** (F-04).
4. **The SSRF defence is incomplete, has no DNS-level protection, is untested (0 tests), and is not wired into any code path** (F-05).
5. **The repository has no committed implementation** (only `README.md` is tracked) and the packages are not on npm (F-06, F-07).

None of these are architectural dead-ends; all are fixable without redesign. This is therefore *CHANGES REQUIRED*, not *REJECTED*.

---

## 2. Architecture Assessment

Detail: [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md).

| Rule | Result | Evidence |
| --- | --- | --- |
| Core independent of Next.js/Express/React/DOM | **Verified** | No such imports in `packages/core/src`; core bundle imports only cheerio, turndown, turndown-plugin-gfm, yaml, zod, `crypto`. |
| Core independent of Growixa | **Verified** | `grep -i growixa` hits only prose (README/CONTRIBUTING/AGENTS/docs); zero code/manifest references. |
| Adapters depend on core, not vice-versa | **Verified** | `nextjs`, `node`, `cli` → `@iitdeveloper/core`; no reverse edges. |
| No database / microservices | **Verified** | In-memory `ContentRegistry`; no services. |
| Core is "pure Web-standard" | **Partially** | Uses `Buffer`, `node:crypto` (`cache/index.ts:1`), `Buffer.byteLength` → not Edge-runtime safe (see F-03). |
| Optional integrations optional | **Verified** | `next`/`express` are optional peers. |
| Unnecessary duplication | **Finding** | llms/llms-full/negotiation/cache-header blocks copy-pasted 3× (node middleware, fetch handler, Next handler) and have already drifted (F-18/L-03). |

---

## 3. Security Assessment

Detail: [SECURITY_REVIEW.md](SECURITY_REVIEW.md). Highlights:

- **Good:** path-traversal guard rejects `..`, `%2e%2e`, NUL, backslash variants (probed); draft pages are not served via registry (probed through Express and Fetch handler); redirects are re-validated hop-by-hop; symlinks are skipped by the CLI crawler; Express `POST /llms.txt` etc. leak nothing sensitive.
- **Bad:** SSRF filter allows `localhost.`, `*.localhost`, `metadata.google.internal`, `192.0.0.0/24`, `198.18.0.0/15`, multicast, `fec0::/10`, NAT64 `64:ff9b::/96`, 6to4, and any public DNS name that resolves to a private address (`127.0.0.1.nip.io`). There is **no DNS resolution step and no IP pinning**, so DNS rebinding is unmitigated. Verified: a mocked 302 to `http://metadata.google.internal/` is followed and its body returned.
- **Bad:** `safeFetchUrl` — the only SSRF-protected fetcher — has **0 tests and 0 call sites**. `SecurityOptions.ssrfProtection`, `maxOutputSizeBytes`, `allowedPaths` are accepted but never read; the adapters never read `options.security` at all.
- **Dependency audit:** `npm audit` on a clean install of `@iitdeveloper/core` → **2 high** (`zod@3.25.76`, GHSA-mrhx-c7xc-m3w5, CWE-770, range `<4.6.6`); every consumer sees this warning.
- **DoS:** HTML nested ≥5000 levels → stack overflow (`MarkdownConversionError`, aborts a CLI build); a 2.1 MB, 100k-row table took **9.1 s** synchronous CPU.

---

## 4. Feature Verification Matrix

| Capability (claim) | Status | Evidence |
| --- | --- | --- |
| Accept-header negotiation (q-values, wildcards, invalid) | **Verified** | 17-case probe; `*/*`, `text/*`, `q=0`, garbage → HTML; md-only → Markdown. |
| `.md` / `?format=` precedence over Accept | **Verified** | `/p.md` + `Accept: text/html` → Markdown; `?format=html` + `Accept: text/markdown` → HTML. |
| `Vary: Accept` on Accept-negotiated Markdown | **Verified** | Express/Fetch/Next responses. |
| `Vary: Accept` on the HTML alternative | **FAILED** | HTML responses (Express, Next) carry no `Vary: Accept` — F-04. |
| No `Vary` when explicit URL format | **Verified** | `/a.md`, `?format=md` responses. |
| Distinct `W/"md-…"` ETags, 304 on If-None-Match | **Verified** | Express curl: 304 with ETag/Last-Modified. |
| HEAD support | **Verified** | Express/Fetch/Next. |
| HTML→Markdown (headings, lists, tables, code, images, unicode) | **Verified** | Fixture `index.md`. |
| Nav/footer/script removal | **Verified** | Fixture. |
| "Meaningful content not removed" | **FAILED** | 2nd `<article>` dropped; `<aside>` and `.modal` content dropped; `<h1>` in `<header>` outside `<main>` dropped — F-11. |
| Unsafe URL schemes sanitised | **Not implemented** | `[xss](javascript:alert\(1\))` kept in output. |
| Structured registry / drafts hidden | **Verified** | Fetch & Express probes. |
| `llms.txt` / `llms-full.txt` generation | **Partially** | Works; injection (F-10), order-dependent (F-18), includes private/404/admin pages from CLI (F-09). |
| Deterministic output | **Partially** | Same input order → same output; no sorting of pages; CLI relies on `readdir` order. |
| Next.js App Router (14.x & 15.x claimed) | **FAILED** | Build error on 15.5.28 and 16.4.4; quickstart endpoint 404s — F-02/F-03. Next 14 **unverified**. |
| Express / Connect | **Verified** | Live server, curl. |
| Fetch API handler (Hono/Fastify/Workers claimed) | **Partially** | Handler works in Node; Hono/Workers/Fastify **unverified**; no Fastify adapter exists. |
| Static-site CLI on plain HTML | **Partially** | Works; destructive overwrite (F-01), no publishing guard (F-09). |
| `init` → `validate` → `generate-llms` workflow | **FAILED** | `init` writes `.ts`; `validate`/`generate-llms` read `.json` only — F-08. |
| PHP adapter | **Partially** | Serves `.md`; ignores q-values; encoded paths don't resolve — F-16. WordPress **unverified**. |
| npm install / `npx @iitdeveloper/cli` | **FAILED (today)** | Registry `E404` — F-06. Works from tarballs. |
| ESM / CJS / `.d.ts` | **Verified** | Clean consumer, `tsc --strict` under `nodenext` and `bundler`. |

---

## 5. Framework Compatibility Matrix

Detail: [COMPATIBILITY_REVIEW.md](COMPATIBILITY_REVIEW.md).

| Target | Result |
| --- | --- |
| Node 22 (ESM, CJS) | Pass |
| Node 18 / 20 | Not run (CI matrix claims; unverified locally) |
| Express 4 | Pass |
| Next.js 16.4.4 (Turbopack and webpack) | **Build fails** by default; builds only with undocumented `serverExternalPackages`; requires `proxy.ts` (Node runtime), docs' `middleware.ts` fails |
| Next.js 15.5.28 | **Build fails** by default; same workaround |
| Next.js 14 | Unverified |
| Plain static HTML (build-time CLI) | Works with defects |
| GitHub Pages / Netlify / Vercel / Nginx / Apache | Not deployed; static analysis only (see report) |
| PHP 8 built-in server | Works with defects |

---

## 6. Test Results (exact commands run, repo root unless stated)

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Pass (4 packages) |
| `pnpm lint` | Pass (no output) |
| `pnpm build` | Pass (tsup, ESM+CJS+DTS for 4 packages) |
| `pnpm vitest run` | **79/79 pass**, 11 files, ~0.9 s — claim of 79 tests **verified** |
| `pnpm test:coverage` | **Fails**: `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'` |
| `vitest run --coverage` in throw-away copy (added `@vitest/coverage-v8@3.2.7`) | **72.82 % stmts / 70.91 % branch / 83.82 % funcs**; `core/security` 45.12 %, `cli/index.ts` 32.16 %, `nextjs` 42.78 %, `node` 68.66 %, `cli/bin.ts` 0 % |
| `pnpm pack` ×4 + clean `npm i <tgz…>` | Pass (with `overrides` – core not on registry) |
| Consumer `node esm.mjs`, `node cjs.cjs`, `tsc --strict` (nodenext + bundler) | Pass |
| `next build` (15.5.28, 16.4.4; Turbopack + webpack) | **Fail** (see F-02) |
| Live Express + curl; live `next start` + curl; PHP `-S` + curl | See matrix |
| `npm audit` (core only) | **2 high** (zod) |

Formatting check: no formatter (Prettier/Biome) is configured in the repo, so none was run.

---

## 7. Critical and High-Priority Findings (P0 / P1)

| ID | Sev | Finding | Where |
| --- | --- | --- | --- |
| F-01 | **P0** | `agent-content build` silently overwrites existing `.htaccess`, `_headers` (and writes `nginx-agent-content.conf`) in the site root; `--generate-rules` defaults to `true` and cannot be disabled; output dir defaults to the source dir. Verified: pre-existing `RewriteRule ^old$ /new [R=301]` and `/old X-Mine: yes` were destroyed. | `cli/src/index.ts:81`, `cli/src/build.ts:224-295` |
| F-02 | P1 | `@iitdeveloper/core` fails to bundle in Next.js (Turbopack and webpack): `import * as gfmPlugin from 'turndown-plugin-gfm'` then `gfmPlugin.default?.gfm` → "does not contain a default export". Next 15.5.28 and 16.4.4 both fail. | `core/src/markdown/index.ts:4,64-66` |
| F-03 | P1 | README/docs Next.js quickstart yields no working endpoint: `/about.md` 404, `Accept: text/markdown` → HTML, `/api/agent-content/about.md` 404 (handler resolves the *prefixed* path). Docs' `middleware.ts` rewrite fails to bundle (Edge + core's Node deps) and `middleware` is deprecated in Next 16; only a Node-runtime `proxy.ts` works. | `docs/NEXTJS_INTEGRATION.md §4`, README Option A, `nextjs/src/index.ts:111-137` |
| F-04 | P1 | HTML responses to Accept-negotiated URLs have no `Vary: Accept` (Next: `Cache-Control: s-maxage=31536000`). A shared cache that stores the HTML first serves it to Markdown clients, and vice-versa. Violates `AGENTS.md §2.5` and README "CDN … never confuse". Root cause: `shouldVaryAccept:false` for `source:'default'` even when an `Accept` header drove the decision. | `core/src/negotiation/index.ts:240-246`, adapters |
| F-05 | P1 | SSRF protection incomplete, no DNS resolution/pinning, untested, unused (details in SECURITY_REVIEW). | `core/src/security/index.ts:126-298` |
| F-06 | P1 | Packages are not published (`E404` for `@iitdeveloper/core`); every README/`npx` instruction fails today. Ownership of the `@iitdeveloper` npm scope is not demonstrated by the repo. | README, docs |
| F-07 | P1 | Git tracks **only `README.md`**; all source, CI, LICENSE, docs are untracked (20 untracked entries). The release workflow checks out the repo and would have nothing to build; no history exists to audit. `.venv/` (pip tree) sits in the project dir and is **not** in `.gitignore`. | `git ls-files` |

## 8. Medium and Low-Priority Findings

**P2**
- F-08 CLI `init` writes `agent-content.config.ts`; `validate` and `generate-llms` accept only JSON (default `agent-content.config.json`) → documented init→validate flow cannot work.
- F-09 CLI publishes `_private/x.html`, `admin/`, `404.html`, `noindex` pages into `.md`, `llms.txt`, `llms-full.txt` (only *files* starting with `_` are skipped, not directories); `--exclude` matches directory names only despite "patterns" help text.
- F-10 `llms.txt` generation does not escape titles/descriptions: a `<meta description>` containing a newline injected a `## Injected` heading; a title containing `[x](http://evil)` produced nested link markup.
- F-11 Markdown content loss: only the first `main, article, [role=main]` is converted (blog index with N articles keeps 1); `<aside>` and `.modal/.popup/.dialog/.ad` removed even when they hold content; headings in `<header>` outside `<main>` lost; `javascript:` URLs preserved.
- F-12 Resource limits: stack overflow ≥5000 nested elements; 2.1 MB table = 9.1 s; CLI `build` has no per-file error isolation (one bad page aborts after partial writes).
- F-13 `zod@3.25.76` audit advisory (2 high for every consumer).
- F-14 Dead security configuration: `ssrfProtection`, `maxOutputSizeBytes`, `allowedPaths` never read; adapters ignore `options.security`.
- F-15 Test quality gaps (72.8 % coverage; security 45 %; `safeFetchUrl`, CLI `init/validate/generate-llms`, Next handler fallback paths untested; tests alias to `src`, never exercising built bundles; `test:coverage` script broken).
- F-16 PHP adapter ignores q-values (`text/html;q=1, text/markdown;q=0.5` → Markdown) contradicting the core; percent-encoded paths never match files; no `Vary: Accept` on HTML fall-through.
- F-17 `Cache-Control: public` default is also applied to `fallbackHtml`-derived Markdown (may be per-user); no guard for `Authorization`/`Cookie`.
- F-18 Non-deterministic ordering: `llms.txt` preserves caller order; CLI `findHtmlFiles` uses unsorted `readdirSync` (platform-dependent), so the same site can yield different `llms.txt` on Linux vs macOS.
- F-19 Unsupported documentation claims (list in OPEN_SOURCE_READINESS §6).
- F-20 Release pipeline weaknesses (unused `version_bump` input, `--frozen-lockfile=false`, long-lived `NPM_TOKEN` rather than trusted publishing, no `--provenance`, no per-package README).

**P3**
- L-01 `/\.\./` check is substring-based and rejects legitimate `/file..md`, `/v1..2`.
- L-02 Discovery endpoints answer any HTTP method and any path ending in `/llms.txt`.
- L-03 Three copies of discovery/negotiation/header logic have drifted (e.g. Next's 404 has `nosniff`, Fetch handler's HTML 404 does not; Next `createLlmsTxtHandler` ignores configured cache options).
- L-04 Equal-q `text/html;q=.5, text/markdown;q=.5` yields Markdown (defensible, but undocumented).
- L-05 GitHub Pages sample workflow omits `actions/upload-pages-artifact` and `pages: write`/`id-token: write` permissions.
- L-06 `about.md` output lacks trailing newline when no frontmatter; page title falls back to the route (`/about`) in `llms.txt`.

## 9. Open-Source Readiness

Detail: [OPEN_SOURCE_READINESS.md](OPEN_SOURCE_READINESS.md). Apache-2.0 `LICENSE` present (191 lines) and consistently declared; CoC, CONTRIBUTING, SECURITY (reporting address provided), issue/PR templates, CHANGELOG exist. Blocking gaps: uncommitted source, unpublished/unclaimed scope, no per-package READMEs in tarballs, inaccurate compatibility claims, dependency audit noise.

## 10. Recommended Fixes (priority order)

1. **F-01:** make rule generation opt-in (`--generate-rules`, default off), refuse to overwrite existing files unless `--force`, and write rules into `--out-dir` only.
2. **F-02:** replace the namespace import with `import { gfm } from 'turndown-plugin-gfm'` (add a `declare module` typing) or interop via `createRequire`; add a CI job that builds a real Next 15 and 16 fixture from the packed tarballs.
3. **F-03:** ship a route-prefix-agnostic handler (`basePath`/`stripPrefix` option or compute from `params.slug`), rewrite README/docs to the verified `proxy.ts` (Next 16) / `middleware.ts` (Next ≤15, Node runtime) recipe, and document that core is Node-runtime only (or remove `node:crypto`/`Buffer` to enable Edge).
4. **F-04:** set `Vary: Accept` whenever the `Accept` header was *consulted* (i.e. no explicit URL format), on both representations, including errors and pass-through; adapters must append to existing `Vary`.
5. **F-05:** resolve DNS (`dns.lookup({all:true})`), reject if *any* address is non-public, connect to the validated IP (undici `Agent` with custom `lookup`) preserving `Host`/SNI; use a complete IPv4/IPv6 special-use table (or `ipaddr.js`); block `.localhost`, trailing-dot, metadata hostnames; add tests (including a local rebinding fixture) and either use `safeFetchUrl` somewhere or mark it clearly as a utility.
6. **F-06/F-07:** commit everything, confirm npm scope ownership, publish with trusted publishing + provenance only after fixes.
7. **F-08–F-12, F-14:** fix CLI config flow; default-deny non-content pages (honour `noindex`, `_`/`.` directories, `404.html`, `--include` globs); escape llms.txt fields; convert *all* `article`s or fall back to `body`; remove or implement dead security options; add per-file try/catch and an iterative/depth-limited converter.
8. Bump/replace `zod` (v4 ≥ 4.6.6) or add `overrides` guidance; add coverage dependency + thresholds; test packaged artefacts.

## 11. Release Readiness Decision

**Do not release v0.1.0 in its current state.** Re-review is required after F-01 – F-07 are fixed with regression tests. After those, the release can move to *APPROVED WITH CONDITIONS* provided P2 items are triaged in the changelog as known limitations. Next-steps authorisation: per review-only mode, no fixes have been implemented; a separate `review-fix` branch is required once authorised.

*Unverified (explicitly not claimed as working):* Next.js 14, Node 18/20 runtime, Hono, Cloudflare Workers, Fastify, WordPress, Netlify/Vercel/GitHub Pages/Nginx/Apache deployments, Windows paths, large-site (>10k pages) performance.
