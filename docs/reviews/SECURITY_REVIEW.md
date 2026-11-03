# AgentContent v0.1.0 — Security Review

Date: 2026-11-03 · Mode: review-only · All tests were local, against fixtures created in the session scratchpad (no external systems were targeted; the SSRF redirect test used a **mocked `fetch`**).

Severity scale: P0 critical · P1 high · P2 medium · P3 low · Info.

## Summary

| ID | Sev | Title |
| --- | --- | --- |
| S-01 | P0 | CLI silently overwrites `.htaccess` / `_headers` (destructive filesystem write) |
| S-02 | P1 | SSRF filter bypasses: incomplete hostname/IP deny-list |
| S-03 | P1 | No DNS resolution / IP pinning → DNS rebinding and "public name → private IP" unmitigated |
| S-04 | P1 | `safeFetchUrl` untested and unused; security options are dead config |
| S-05 | P1 | Missing `Vary: Accept` on HTML representation → cache poisoning / wrong-format delivery |
| S-06 | P2 | CLI publishes private/non-content pages |
| S-07 | P2 | `llms.txt` Markdown/newline injection |
| S-08 | P2 | Resource exhaustion in HTML→Markdown (stack overflow, 9 s CPU) |
| S-09 | P2 | `zod@3` high advisory in the dependency tree |
| S-10 | P2 | `public` cache default applied to fallback-rendered content |
| S-11 | P3 | `javascript:` / dangerous URL schemes preserved in Markdown |
| S-12 | P3 | PHP adapter: traversal filter is non-canonical; no containment check |
| Info | – | Controls that held up |

---

## S-01 — Destructive overwrite of server config (P0)

- **File/line:** `packages/cli/src/index.ts:81` (`.option('--generate-rules', …, true)`), `packages/cli/src/build.ts:224-295` (`writeFileSync(join(outDir,'_headers'|'.htaccess'|…))`), `build.ts:91` (default `outDir = sourceDir`).
- **Scenario:** A developer runs `npx @iitdeveloper/cli build --dir .` in a site that already has `.htaccess` (redirects, auth) or `_headers`.
- **Reproduction:** fixture `site/` with `.htaccess` = `# Existing\nRewriteRule ^old$ /new [R=301]` and `_headers` = `/old\n  X-Mine: yes`; run `node packages/cli/dist/bin.js build --dir site --base-url https://acme.test`. Both files were replaced by generated content; no prompt, no backup, flag cannot be disabled (commander boolean with default `true` has no `--no-` form declared).
- **Impact:** loss of redirect/auth/security-header configuration, potentially taking an Apache site's protections offline silently. Rated P0 under the "destructive behaviour" rule.
- **Fix:** opt-in flag, `wx` open flag / existence check with `--force`, never write to dotfiles in the source tree by default, write to `--out-dir`.
- **Verify:** regression test that pre-existing `.htaccess` content is byte-identical after `build`.

## S-02 — SSRF deny-list gaps (P1)

- **File/line:** `packages/core/src/security/index.ts:51-120` (IP tables), `:162-165` (hostnames).
- **Probe results** (`validateUrlForSSRF`, built `dist`): **blocked correctly:** `127.0.0.1`, decimal `2130706433`, hex `0x7f.0.0.1`, octal, `127.1`, `::1`, `[0:0:0:0:0:0:0:1]`, `::ffff:127.0.0.1`, `::ffff:7f00:1`, `::ffff:a9fe:a9fe`, `169.254.169.254`, `fd00::1`, non-http(s) schemes. **ALLOWED (should be blocked):**

| Input | Why it matters |
| --- | --- |
| `http://localhost./` | trailing-dot FQDN of localhost |
| `http://foo.localhost/` | RFC 6761: resolves to loopback in many resolvers |
| `http://metadata.google.internal/` | GCP metadata hostname |
| `http://127.0.0.1.nip.io/` | public name → 127.0.0.1 |
| `http://192.0.0.1/` (192.0.0.0/24) | IETF protocol assignments (e.g. Oracle metadata `192.0.0.192`) |
| `http://198.18.0.1/` (198.18.0.0/15) | benchmarking range |
| `http://224.0.0.1/`, `255.255.255.255` | multicast / broadcast |
| `http://[64:ff9b::7f00:1]/` | NAT64 embedding of 127.0.0.1 |
| `http://[2002:7f00:1::]/` | 6to4 embedding of 127.0.0.1 |
| `http://[fec0::1]/` | deprecated site-local |

- **Redirect test (mocked fetch):** a `302 → http://169.254.169.254/latest` was correctly blocked (hop re-validation works); a `302 → http://metadata.google.internal/` was **followed and the body returned** (`LEAK`).
- **Also:** the IPv4-mapped hex branch only inspects the first 16-bit word (`security/index.ts:109-115`) and substitutes `.0.1` for the rest, so it is correct only for /16-granularity checks.
- **Fix:** complete special-use registries (IANA IPv4/IPv6 special-purpose tables), normalise via `net.isIP`/BigInt ranges, block `.localhost`, `.internal`, trailing dots.

## S-03 — No DNS resolution; DNS rebinding unmitigated (P1)

- **Evidence:** `grep -rn "dns" packages/core/src` → 0 hits. `validateUrlForSSRF` validates the *literal* hostname string only; `fetch(currentUrl)` then resolves it independently.
- **Scenario:** attacker-controlled `evil.example` with A=public IP at check time and A=`169.254.169.254` (or 127.0.0.1) at connect time, or simply a record permanently pointing at a private IP (`127.0.0.1.nip.io` passes the filter).
- **Impact:** full SSRF for any caller that passes user-influenced URLs to `safeFetchUrl`.
- **Fix:** resolve all A/AAAA records, reject if any is non-public, connect to the validated address (custom `lookup`/undici `Agent`), re-do per redirect hop; cap response time per hop.
- **Verify:** a local test DNS stub (or injected resolver) that flips answers between check and connect.

## S-04 — Security controls untested, unused or dead (P1)

- `safeFetchUrl`: **0 tests, 0 call sites** in the monorepo (coverage: `security/index.ts` 45.12 %, lines 188-298 uncovered). The adapters' `fallbackHtml` hooks are user-supplied and do not use it.
- `SecurityOptions.ssrfProtection`, `maxOutputSizeBytes`, `allowedPaths` are never read anywhere (`grep` outside `types/` = 0). Adapters accept `security?:` but never reference `options.security`.
- Docs/README ("request/response size limits", "enterprise security by default") therefore overstate. `maxInputSizeBytes` in `htmlToMarkdown` (5 MB default) is the only enforced limit.
- **Fix:** wire or delete; add behavioural tests for every documented option.

## S-05 — `Vary: Accept` missing on the HTML alternative (P1)

- **Evidence (Express):** `GET /pricing` with browser `Accept` → `Content-Type: text/html`, no `Vary`. Markdown for the same URL → `Vary: Accept`. **Evidence (Next 16 `next start`):** HTML for `/about` → `Cache-Control: s-maxage=31536000`, `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding` — no `Accept`.
- **Scenario:** CDN caches `/about` HTML (response has no `Vary: Accept`; per RFC 9111 it matches every request) → agents sending `Accept: text/markdown` receive cached HTML indefinitely; or, with a Markdown response cached first under `Vary: Accept` the cache stays correct only if the HTML response also varies. Either way "CDNs never confuse HTML and Markdown" is false.
- **Root cause:** `getRequestedFormat` returns `shouldVaryAccept:false` for `source:'default'` (`negotiation/index.ts:240-246`) even when an `Accept` header was inspected; adapters pass through to `next()` without adding the header.
- **Fix:** adapters (and a documented helper) set/append `Vary: Accept` on every response to a URL where explicit format was absent; add integration test using a simulated shared cache.

## S-06 — CLI publishes non-content pages (P2)

- **Evidence:** `site/_private/x.html`, `site/admin/index.html`, `404.html`, `contact.html` (`<meta name="robots" content="noindex">`) all converted and listed in `llms.txt` / `llms-full.txt` (`## _PRIVATE`, `## ADMIN`, `## 404`). `.md` twins are written beside the HTML and thus become public URLs.
- **Code:** `build.ts:57-83` skips only dot-directories, fixed names, and *files* starting with `.`/`_`.
- **Fix:** default-deny list (`_*`, `admin`, `private`, `404`), honour `noindex` and `X-Robots`, explicit `--include`.

## S-07 — `llms.txt` injection (P2)

- **Evidence:** `<meta name="description" content="line1&#10;## Injected">` produced `- [Blog …](…/blog): line1⏎## Injected` as a new top-level heading; title `Blog [x](http://evil)` rendered a nested link.
- **Code:** `discovery/index.ts:87-97` interpolates unescaped `title`/`description`.
- **Impact:** a page author (or compromised CMS field) can steer LLM consumers of `llms.txt`. Fix: collapse whitespace, escape `[]()`.

## S-08 — Resource exhaustion (P2)

- Nested `<div>` ×1000 OK; ×5000 and ×10000 → `Maximum call stack size exceeded` (wrapped as `MarkdownConversionError`). Both under the 5 MB limit.
- `<table>` with 100 000 rows (~2.1 MB) → **9 093 ms** synchronous (event-loop blocking) in `htmlToMarkdown`; 4 MB paragraph → 646 ms.
- CLI `build` has no per-file try/catch, so one hostile page aborts the build mid-write.
- **Fix:** depth cap (e.g. 256) before Turndown, lower default size or element-count caps, per-file error isolation, worker/timeout for server-side fallback conversion.

## S-09 — Dependency advisory (P2)

`npm i <core tgz> && npm audit` → `zod@3.25.76`: GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized constrained collections, CVSS 7.5, `<4.6.6`; no 3.x fix). Practical exposure is low (registry schemas use few constrained collections) but consumers see **2 high** vulnerabilities on install. Upgrade to zod ≥ 4.6.6 or drop zod from the runtime path.

## S-10 — Cache leakage risk (P2)

Adapters emit `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` for any Markdown including output of the user-supplied `fallbackHtml` (`node/src/index.ts:166`, `nextjs/src/index.ts:175`). If the fallback renders authenticated content, a shared cache may serve it to others. Fix: default `private` for fallback content or when `Authorization`/`Cookie` present; document.

## S-11 — Dangerous URL schemes retained (P3)

`<a href="javascript:alert(1)">` → `[xss](javascript:alert\(1\))`. Markdown is text, but downstream renderers may link it. Strip or neutralise `javascript:`, `vbscript:`, `data:text/html`.

## S-12 — PHP adapter path handling (P3)

`examples/php/AgentContent.php:62`: `str_replace(['..', "\0"], '', …)` is a non-canonical filter (order-dependent `.\0.` pattern) and there is no `realpath` containment check. Probes (`/../secret.md`, `/a/../../secret.md`, `/....//secret.md`) did **not** escape on PHP's built-in server (raw `NUL` cannot be sent over HTTP), so rated P3. Also, `REQUEST_URI` is not percent-decoded, so `/my%20page.md` never maps to `my page.md`.

## Controls that held up (Info)

- `validateAndNormalizePath`: rejected `/a/../b`, `%2e%2e`, `..%2f`, `\..\`, `%00`; `%252e%252e` decodes once to literal `%2e%2e` (harmless as no further decoding occurs); encoded traversal via Express (`/%2e%2e/%2e%2e/etc/passwd.md`) → 400; raw `--path-as-is /../../etc/passwd` → handled by the app (200 HTML) and not by AgentContent.
- Draft isolation: `/d.md` → 404 (Fetch) / falls through to app HTML (Express). Registry `getMarkdown` throws for non-published.
- Symlinks: CLI ignores symlinked files/dirs (`evil.html → /etc/hosts`, `blogs → /etc` not converted).
- YAML: `yaml@2.9.1` used with `parse` on frontmatter; no custom tags, alias count capped by library default.
- `X-Content-Type-Options: nosniff` present on Express, Fetch and Next Markdown/text responses (not on the Fetch handler's HTML 404).
- Redirect re-validation, timeout and streaming size cap logic in `safeFetchUrl` read correctly (but see S-02–S-04).
