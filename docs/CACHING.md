# HTTP Caching & CDN Integration Guide

Caching representations correctly is critical in multi-representation web applications. This guide details how AgentContent handles ETags, 304 conditional responses, and CDN cache segregation.

---

## 1. The Cache Collision Problem

When a URL like `/pricing` can return both HTML (to a browser) and Markdown (to an AI crawler), a shared cache (Cloudflare, Fastly, CloudFront, Vercel Edge) might cache the Markdown response and serve it to a subsequent human browser, or cache the HTML response and serve it to an AI agent.

```
       Browser (Accept: text/html)  ──┐
                                      ├──► [ Shared CDN Cache ] ──► Origin
    AI Agent (Accept: text/markdown) ──┘
```

---

## 2. AgentContent Solutions

### 2.1 The `Vary: Accept` Header
Whenever content format is determined based on the `Accept` header, AgentContent automatically sets:
```http
Vary: Accept
```
This instructs CDNs and browsers to maintain **separate cache entries** for different `Accept` values.

**Framework caveat (Next.js):** Next.js controls the `Vary` header of its own HTML page responses and replaces any value set from `proxy.ts`/`middleware.ts` or `next.config`. AgentContent can only add `Vary: Accept` to the responses it produces itself (Markdown, `llms.txt`, and the Express/Node/Fetch/PHP pass-through paths). When a Next.js app is fronted by a shared cache and serves both formats from one URL, configure the CDN cache key to include `Accept`, or direct agents to `/page.md`. See the [Next.js guide](NEXTJS_INTEGRATION.md#cdn-caching-caveat-vary-accept-on-nextjs-html-pages).

### 2.2 Dedicated URI Representation (`/page.md` & `?format=md`)
When a client requests `/pricing.md` or `/pricing?format=md`, the representation is uniquely identified by the URL path/query. In this case:
- AgentContent **omits** `Vary: Accept`.
- The CDN can cache the response cleanly under the unique URL key.

### 2.3 Representation-Specific ETags
AgentContent hashes the Markdown output and prefixes the tag with `md-`:
```http
ETag: W/"md-4f8a3bc9e12"
```
Because the origin's HTML handler uses a different ETag (e.g. `W/"html-..."`), client and intermediate caches cannot confuse the two representations.

---

## 3. Conditional Requests (304 Not Modified)

AgentContent natively implements conditional GET requests:
- **`If-None-Match`**: Compared against the current representation's ETag.
- **`If-Modified-Since`**: Compared against the page's `updatedAt` or `publishedAt` timestamp.

When fresh, AgentContent responds with:
```http
HTTP/1.1 304 Not Modified
ETag: W/"md-4f8a3bc9e12"
```
The response body is completely omitted, conserving bandwidth and CPU.

---

## 4. Cache-Control Directives

By default, AgentContent emits:
```http
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```
This allows:
- 1 hour of public caching on CDNs and browser caches.
- 24 hours of background stale-while-revalidate serving for instant response times.

