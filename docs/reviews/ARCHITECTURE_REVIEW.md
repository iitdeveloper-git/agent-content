# AgentContent v0.1.0 — Architecture Review

Date: 2026-11-03 · Scope: monorepo structure, package boundaries, public APIs, runtime assumptions, duplication.

## 1. Structure

```
packages/core    ~1,500 LOC src (negotiation, markdown, metadata, content, discovery, cache, security, errors, types)
packages/node    311 LOC   (Express/Connect middleware + Fetch handler)
packages/nextjs  275 LOC   (App Router GET/HEAD handlers + llms handlers)
packages/cli     ~520 LOC  (commander CLI + static builder)
examples/        basic-node, nextjs-app-router, structured-content, php
tests/           integration/http-delivery.test.ts
```

pnpm workspace (`packages/*`, `examples/*`), strict TS (`noUncheckedIndexedAccess`, `noUnusedLocals`), tsup builds ESM+CJS+DTS. Typecheck, lint, build all pass.

## 2. Boundary verification

| Rule (AGENTS.md / review brief) | Verdict | Evidence |
| --- | --- | --- |
| Core has no Next/Express/React/DOM imports | ✅ | `core/src` imports only `cheerio`, `turndown`, `turndown-plugin-gfm`, `yaml`, `zod`, `node:crypto`. (tsconfig `lib` includes `DOM` for types only.) |
| Core independent of Growixa | ✅ | No references in code/manifests; prose-only independence statements. |
| Adapters → core only | ✅ | `nextjs`, `node`, `cli` depend on `@iitdeveloper/core`; no cycles (`core` has no workspace deps). |
| Static tooling runs without a framework | ✅ | CLI depends on core + commander + picocolors. |
| Optional frameworks are optional peers | ✅ | `next`, `express` optional peers; adapters don't import them at runtime (types use `node:http` and Fetch). |
| No DB / microservice requirement | ✅ | In-memory registry. |
| "Pure Web-standard APIs" in core (AGENTS §2.2) | ⚠️ | Uses `Buffer` (`markdown/index.ts:122`, `security/index.ts:262,284`) and `node:crypto` SHA-1 (`cache/index.ts:1,24`). Consequently **core cannot be bundled for Edge/Workers** (docs' Next `middleware.ts` fails). Web Crypto is async, so an ETag API change would be required for true portability — a design decision the docs must state either way. |
| Public API typed | ✅ | `.d.ts` verified under `nodenext` and `bundler` with `tsc --strict`. One `@ts-expect-error` hides missing typings for `turndown-plugin-gfm` (see §3). |

## 3. Architectural defects

### A-1 The interop hack that breaks the primary target (F-02)
`markdown/index.ts:3-4` uses `import * as gfmPlugin` (with `@ts-expect-error`) and resolves the plugin through `gfmPlugin.gfm ?? gfmPlugin.default?.gfm ?? gfmPlugin.tables` (`:64-66`). Bundlers statically analyse the namespace and reject the `.default` access on a module that has none, so the library compiles in Node but fails in Next (Turbopack and webpack). The `try { … } catch {}` that silently skips the plugin if loading fails would also mask a missing-tables regression at runtime. Prefer a named import with a local module declaration.

### A-2 Adapter contract is under-specified; logic is triplicated (F-03, L-03)
The three adapters each re-implement: discovery endpoint matching, negotiation → path normalisation → registry lookup → conditional GET → header assembly. They have already drifted:
- Fetch handler returns a bare `404 text/plain` for HTML requests without `nosniff`; Next returns it with `nosniff`; Express calls `next()`.
- Last-Modified: Express/Next compute `updatedAt ?? publishedAt`; Fetch handler uses only `updatedAt`.
- `createLlmsTxtHandler` / `createLlmsFullTxtHandler` (Next) hard-code `Cache-Control` and skip ETag/304, unlike the catch-all handler.
- Only the Express adapter passes unmatched requests through; the Next adapter hard-assumes it is mounted at `/api/agent-content/...` but resolves `request.url` raw, so the lookup path is `/api/agent-content/<page>` unless a Node-runtime proxy rewrites the URL first.
Recommendation: extract a single `handleAgentRequest(request, instance, options): Response | null` in core (Web `Request`/`Response`) and make each adapter a ≤40-line shim; add a `basePath`/`stripPrefix` option.

### A-3 Negotiation semantics lose information needed for caching (F-04)
`getRequestedFormat` returns only `shouldVaryAccept` (true only when Markdown was chosen via `Accept`). The *HTML* decision also depended on `Accept` but is reported as `source:'default'`, `shouldVaryAccept:false`. The result type should expose "varied by Accept" independent of the chosen format (e.g. `consultedAccept: boolean`).

### A-4 Dead configuration surface (F-14)
`SecurityOptions` (6 fields) is part of `AgentContentConfig` and every adapter's options but is consumed only by `safeFetchUrl`, which nothing calls. Three fields (`ssrfProtection`, `maxOutputSizeBytes`, `allowedPaths`) are not consumed at all. Either implement or remove from the public types before 0.1.0 locks them in semver.

### A-5 CLI design issues (F-01, F-08, F-09, F-18)
- Two disjoint configuration worlds: `init` emits TS, `validate`/`generate-llms` accept JSON, `build` takes flags only.
- `build` writes into the source tree by default and conflates "convert" with "emit server config".
- Filtering is an ad-hoc deny-list (`DEFAULT_EXCLUDE_DIRS`), not an allow-list/glob system; `--exclude` matches directory names only.
- `routePath` → `category` derivation uppercases the first path segment (`ABOUT`, `_PRIVATE`), producing odd `llms.txt` section names.
- No per-file error isolation; no sort of discovered files.

### A-6 Conversion pipeline robustness (F-11, F-12)
`htmlToMarkdown` selects a *single* content root (`$('main, article, [role="main"]').first()`), applies a global denylist that includes `aside`, `.modal`, `.popup`, `.dialog`, `.ad`, and converts via recursive Turndown/domino with no depth limit. This is a reasonable heuristic for article pages but wrong for list/index pages and any site using those class names for real content. Recommend: (a) if multiple matches, wrap all; (b) make the denylist opt-out per selector; (c) depth/element caps.

### A-7 Packaging not verified by the build (F-15)
Vitest aliases `@iitdeveloper/*` to `src`, so `exports` maps, tsup output and bundler-compat are never exercised; CI has no consumer-install or framework-fixture stage.

## 4. What is sound

- Clear module split inside core; small, readable functions; consistent error classes with HTTP status codes.
- Negotiation precedence (query > extension > Accept > default) is deterministic and documented; verified by probe.
- Conditional-request implementation handles weak ETags, `*`, lists, and If-Modified-Since second-resolution correctly (unit + live 304).
- Registry validates input with zod and never returns non-published pages via `getMarkdown`.
- The core/adapter split would support a reverse-proxy or WordPress port without redesign, provided A-2 is addressed first.

## 5. Unnecessary complexity

None significant. The only unnecessary abstraction is the unused `SecurityOptions` plumbing (A-4). No microservice, database or global state is present.

## 6. Recommended architectural changes (ordered)

1. Fix A-1 and add a packed-artifact Next fixture to CI.
2. Introduce the shared request handler and `basePath` (A-2), expose `consultedAccept` (A-3).
3. Decide Edge-runtime support explicitly; if "no", say so and require Node runtime; if "yes", remove `Buffer`/`node:crypto` from the hot path.
4. Prune or implement `SecurityOptions` (A-4).
5. Split CLI concerns (convert vs. emit-rules) and unify config handling (A-5).
