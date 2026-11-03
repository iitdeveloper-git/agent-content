# AgentContent v0.1.0 — Test Quality Review

Date: 2026-11-03

## 1. Commands and results

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Pass |
| `pnpm lint` (`eslint packages/**/src/**/*.ts tests/**/*.ts`) | Pass |
| `pnpm build` | Pass |
| `pnpm vitest run` | 11 files / **79 tests pass** (core 56: cache 10, content 6, discovery 4, markdown 9, metadata 5, negotiation 12, security 10; node 5; nextjs 6; cli 2; integration 10). Claim of 79 verified. No `.skip/.only/.todo`. |
| `pnpm test:coverage` | **Fails**: `MISSING DEPENDENCY Cannot find dependency '@vitest/coverage-v8'` (script exists, dependency missing) |
| Coverage in throw-away copy (`pnpm add -D -w @vitest/coverage-v8@3.2.7`, `vitest run --coverage --coverage.include='packages/*/src/**'`) | See §2 |
| Formatter | None configured (no Prettier/Biome) |

## 2. Actual coverage (v8)

| Area | Stmts | Branch | Notes |
| --- | --- | --- | --- |
| **All** | **72.82 %** | 70.91 % | 83.82 % funcs |
| core/negotiation | 89.5 | 67.7 | |
| core/markdown | 87.4 | **54.2** | `baseUrl`, `contentSelector`, error branches thin |
| core/content | 89.6 | 68.5 | |
| core/discovery | 88.8 | 76.5 | |
| core/metadata | 89.4 | 75.0 | |
| core/cache | 100 | 85.7 | |
| **core/security** | **45.12** | 80.0 | lines 188-298 (`safeFetchUrl`) completely uncovered |
| **cli/index.ts** | **32.16** | – | `init`, `validate`, `generate-llms` untested |
| cli/bin.ts | 0 | – | |
| cli/build.ts | 83.95 | 57.7 | |
| **nextjs** | **42.78** | 72.7 | fallback path, 304, llms handlers largely untested |
| node | 68.66 | 64.2 | fetch handler HEAD/304/error paths thin |

No coverage thresholds are enforced in `vitest.config.ts` or CI.

## 3. What the tests do and do not prove

1. **Tests run against `src` via alias** (`vitest.config.ts` `resolve.alias` → `packages/*/src`). No test imports `dist`, a packed tarball, or a bundler. This is why the **Next.js build break (F-02)**, the **Edge-runtime failure** and any `exports` map error were invisible to a green run. 0 occurrences of `dist/` in tests.
2. **No real framework tests.** `nextjs.test.ts` and `node.test.ts` call handlers with synthetic `Request`/mock req-res; no Next build, no Express server, no HTTP socket (the "integration" suite also calls handlers in-process). The Next.js path rewrite problem (F-03) cannot surface.
3. **Security tests cover only pure validators** (`validateUrlForSSRF`, `validateAndNormalizePath`, 10 tests). They never exercise `safeFetchUrl` (redirects, timeout, size cap, streaming) and contain no DNS, `localhost.`, `.localhost`, metadata-hostname, reserved-range, NAT64/6to4 cases — each of which fails against the implementation (SECURITY_REVIEW S-02).
4. **`Vary` is asserted only on the Markdown side.** No test asserts that the HTML alternative varies, so F-04 passes. No shared-cache simulation exists.
5. **Markdown tests** use happy-path fixtures; no test for multiple `<article>`, `<aside>`/`.modal` content, header-outside-main headings, `javascript:` URLs, deep nesting, large tables, malformed HTML, or non-English (my probe covered CJK successfully).
6. **CLI tests (2)** do not check pre-existing file preservation, private-dir exclusion, determinism across ordering, `--exclude` semantics, error isolation, or the `init`→`validate` flow.
7. **Discovery tests (4)** do not test escaping/injection, ordering stability, duplicate normalisation, or `maxPages`.
8. No tests for dead options (`ssrfProtection`, `allowedPaths`, `maxOutputSizeBytes`) — which is why their absence from the implementation went unnoticed.
9. No flakiness observed (suite ~0.9 s, no timers/network); no hidden network dependency.

## 4. Missing test classes (required before release)

- Packaging/"consumer" tests: `npm pack` → install → ESM/CJS/TS import → CLI `--version`.
- Real Next.js fixtures (15 and 16) built with Turbopack and webpack, hitting `/x`, `/x.md`, `?format=md`, `Accept`.
- Express/Fetch end-to-end over a socket, with a mock shared cache asserting `Vary`.
- SSRF: IP table-driven test (every IANA special-use block), hostname cases, DNS-stub rebinding, redirect chains, size/timeouts.
- CLI: fixture sites for destructive-write, private exclusion, symlink, large-site timing, Linux/macOS ordering.
- Fuzz/property tests for Accept parsing and path normalisation.
- Negotiation conformance vectors shared with the PHP adapter.

## 5. CI observations

`.github/workflows/ci.yml` installs with `--frozen-lockfile=false` (lockfile drift allowed), runs typecheck → lint → build → test across Node 18/20/22, but runs no packaging, coverage, audit, or framework-integration step. Node 18 is in the matrix while dev tooling (Vitest 3, current Next) is exercised only where the runner supports it; Node 18 results are **unverified** here.
