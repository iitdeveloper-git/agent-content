# AgentContent v0.1.0 — Compatibility Review

Date: 2026-11-03 · Host: macOS arm64, Node v22.20.0. "Verified" means executed here; "Static analysis" means read but not deployed; "Unverified" means not tested at all.

## 1. Packaging and consumption (clean consumer project, packed tarballs)

Method: `pnpm pack` for core/node/nextjs/cli → new directory → `npm i file:<tgz>` ×4 + `overrides: {"@iitdeveloper/core": "$@iitdeveloper/core"}` (needed only because core is not on the registry).

| Check | Result |
| --- | --- |
| Tarball contents | `dist/**` (ESM `.js`, CJS `.cjs`, `.d.ts`, `.d.cts`, sourcemaps) + `package.json` + `LICENSE`. **No README** in any tarball. Sizes: core 143 KB, cli 22 KB, nextjs 9 KB, node 10 KB. `workspace:*` correctly rewritten to `0.1.0`. |
| ESM `import` of `.`, `./markdown` | Pass |
| CJS `require` of `.`, `./markdown`, node, nextjs | Pass |
| TypeScript `--strict`, `moduleResolution: nodenext` | Pass |
| TypeScript `--strict`, `moduleResolution: bundler` | Pass |
| `agent-content` bin (`--version`, `--help`) | Pass (0.1.0) |
| `npx --no-install @iitdeveloper/cli --version` | Pass (local) |
| `npx -y @iitdeveloper/cli --version` (as README instructs) | **Fail – npm E404** (not published) |
| `npm view @iitdeveloper/core` | E404 (also `@iitdeveloper/agent-content` E404) |
| Install size | `node_modules` 55 MB with express/typescript; core alone 796 KB + deps |
| `npm audit` | 2 high (zod) — see SECURITY_REVIEW S-09 |

**Naming consistency (mandatory investigation):** all manifests, docs and examples consistently use scope `@iitdeveloper/*` with packages `core`, `nextjs`, `node`, `cli`; no `@agent-content/*`, `@growixa/*` or `@iitdeveloper/agent-content` references remain. Remaining inconsistencies: (a) the CLI exposes two bin names (`agent-content`, `agent-content-cli`) while docs use `npx @iitdeveloper/cli` and `npx agent-content`; (b) the README "npm version" badge is a static shields badge, not wired to npm; (c) the repo/product name is "agent-content" while no package carries that name; (d) ownership of the `@iitdeveloper` scope on npm is **not demonstrable** from the repo and must be confirmed before publishing.

## 2. Next.js App Router

Fixture: App Router app with `app/page.tsx`, `app/about/page.tsx`, `app/api/agent-content/[...slug]/route.ts`, `app/llms.txt/route.ts`, `agent-content.config.ts` exactly as in README Option A; packages installed from tarballs.

| Scenario | Result |
| --- | --- |
| Next 16.4.4, Turbopack, README setup | **Build error**: `Export default doesn't exist in target module` at `@iitdeveloper/core/dist/index.js:3` (`import * as gfmPlugin from 'turndown-plugin-gfm'`) |
| Next 16.4.4, `next build --webpack` | **Build error**: `'turndown-plugin-gfm' does not contain a default export (imported as 'gfmPlugin')` |
| Next 15.5.28 (webpack) | **Build error**, same message |
| Next 14 | Unverified |
| Workaround: `serverExternalPackages: ['@iitdeveloper/core','turndown-plugin-gfm']` (undocumented) | Build passes on 15.5.28 and 16.4.4; routes `/api/agent-content/[...slug]`, `/llms.txt` dynamic |
| Runtime (workaround, **no** middleware — README as written) | `GET /about` + `Accept: text/markdown` → **HTML**; `/about.md` → **404**; `/about?format=md` → HTML; `/api/agent-content/about.md` → **404** (path resolved as `/api/agent-content/about`); `/llms.txt` → 200 text/plain |
| Docs §4 `middleware.ts` (Edge) | **Build error** (core is imported into the Edge bundle; core uses `crypto`/`Buffer`, cheerio). Also Next 16 prints "`middleware` file convention is deprecated. Please use `proxy`". |
| `proxy.ts` (Node runtime) rewriting to `/api/agent-content/*` + workaround | **Works**: `/about` + `Accept: text/markdown` → 200 `text/markdown`, `vary: …, Accept`, ETag `W/"md-…"`; `/about.md`, `?format=md` → 200 Markdown; HTML with `Accept: text/html` → HTML; `/secret.md` (draft) → 404 |
| HEAD / 304 | Handler logic covered by unit tests; HEAD returned 404 only for missing doc (expected) |

Conclusion: the Next.js adapter is functionally capable *only* with (1) a core bundling fix, (2) a documented Node-runtime proxy/middleware recipe, and (3) a path-prefix fix. README claim "Next.js 14 / 15 ✅" is **unsupported**; Next 16 is **not supported as shipped**.

## 3. Node.js / Express

Live test: Express 4 server using `createNodeMiddleware`, curl.

| Request | Result |
| --- | --- |
| `Accept: text/markdown` `/pricing` | 200, `text/markdown; charset=utf-8`, `Vary: Accept`, `ETag: W/"md-…"`, `Last-Modified`, `Cache-Control` |
| Browser Accept (`text/html,…,*/*;q=0.8`) | falls to app: HTML, **no `Vary: Accept`** |
| `/pricing.md` | 200 Markdown, no Vary (explicit URL) |
| `If-None-Match: <etag>` | 304 |
| `/draft.md` | passes to app (not exposed) |
| `/%2e%2e/%2e%2e/etc/passwd.md` | 400 |
| `/llms.txt` | 200 `text/plain`; ETag `W/"llms-…"` |
| `POST /llms.txt` | 200 (method not checked; P3) |

Fetch handler (`createFetchHandler`) behaviour (called directly with `Request`): Markdown/`.md`/`?format=md`/HEAD/404 correct; HTML-preference request returns **404** "Not Found or HTML not handled" (it is not a pass-through handler — fine for Workers/Hono mounted on `.md` routes but not documented as such). Hono, Fastify, Cloudflare Workers, Bun, Deno: **unverified**. No Fastify package or adapter exists; README implies one.

## 4. Static website (build-time CLI)

Fixture: `index.html`, `about.html`, `contact.html`, `404.html`, `admin/index.html`, `_private/x.html`, `blog/index.html`, `css/ js/ images/` directories, symlinks, pre-existing `.htaccess`/`_headers`.

| Check | Result |
| --- | --- |
| Zero application code beyond build-time CLI | Yes — static output only |
| HTML discovery | Recursive; skips dot-dirs, `node_modules`, `dist`, `build`…, files starting `_`/`.`; **does not** skip `_private/` directory contents |
| Output | `.md` next to each `.html` (default outDir = source dir); `docs/index.html` also writes `docs.md`; root `index.html` → `index.md` only |
| Relative URLs | Rewritten to absolute against `--base-url` (default `https://example.com` silently if omitted) |
| Symlinks | Skipped (good) |
| Path traversal | Output path derived from walked relative paths; not exploitable via file names |
| Determinism | Sort order depends on `readdirSync` (APFS returned sorted; ext4 does not) — **unverified on Linux** but code is order-dependent |
| Private/noindex handling | **None** (see SECURITY_REVIEW S-06) |
| Hosting-rule generation | Overwrote existing `.htaccess`/`_headers` (**S-01**) |
| `init` → `validate` | Broken (`.ts` vs `.json`) |
| Performance | 7 pages: 57 ms. Larger-site performance **unverified**; synchronous, single-threaded; 100k-row table = 9 s (S-08) |

### Static vs. real-time negotiation (precision required)

A static site cannot negotiate by itself. What the CLI produces is **pre-rendered `.md` files + `llms.txt`**. Whether `Accept: text/markdown` or `?format=md` works on `/page` depends entirely on the host. Docs are largely honest about this for GitHub Pages; for others they overclaim (below).

| Host | Claim in README | Independent assessment (static analysis; not deployed) |
| --- | --- | --- |
| **GitHub Pages** | ✅ pre-built `.md` URLs | Docs correctly state no Accept negotiation, no custom headers. Statement that Fastly serves `.md` as `text/plain` is **unverified**. Sample workflow lacks `actions/upload-pages-artifact` and Pages permissions → would fail as written. README ✅ is acceptable only if read as "static `.md` URLs". |
| **Netlify** | ✅ `_headers` + Edge Functions | Generated `_headers` only sets content-type for `*.md`. Header negotiation requires the user to write the Edge Function from the docs (not generated, untested). `_redirects` `format=md` syntax is plausible; untested. No `Vary` anywhere. |
| **Vercel** | ✅ `vercel.json` | Not generated by CLI; docs-only; untested. |
| **Apache** | ✅ | Generated `.htaccess` rewrites `Accept: text/markdown` to `$1.md` **without `Vary: Accept`** → CDN poisoning (same class as S-05); `%{REQUEST_FILENAME}\.md -f` never matches `/` or directory URLs; `httpd` is installed locally but was **not** run against the snippet. |
| **Nginx** | ✅ | Generated snippet uses `if` + `rewrite … break` inside `location /` (known "if is evil" pattern); rewrites `/` → `/.md`; no `Vary`; nginx not installed — **unverified**. |
| PHP / WordPress | ✅ | See §5; WordPress unverified. |

## 5. PHP adapter (`examples/php/AgentContent.php`)

Run with `php -S` and curl: Markdown served for `/about` when asked; **q-values ignored** (`Accept: text/html;q=1, text/markdown;q=0.5` → Markdown; core returns HTML); `HTML FALLTHROUGH` correct otherwise; traversal probes did not escape; percent-encoded names never resolve; no `Vary` on HTML. It lives in `examples/`, is not packaged/tested/versioned, yet README lists "PHP & WordPress ✅".

## 6. Future-integration fitness

Core's pure functions (`getRequestedFormat`, `htmlToMarkdown`, ETag/conditional helpers, `generateLlmsTxt`) are adapter-agnostic, and a reverse-proxy/WordPress/PHP port is feasible. Gaps: negotiation semantics are re-implemented rather than specified (PHP diverges); a conformance fixture set (input headers → expected output + Vary) would let non-JS adapters stay consistent.
