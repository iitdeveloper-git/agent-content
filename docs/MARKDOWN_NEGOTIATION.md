# HTTP Content Negotiation Specification

Detailed rules, RFC 9110 compliance, and header semantics in AgentContent.

---

## 1. Supported Inputs

AgentContent responds to three negotiation mechanisms:

### 1. HTTP Accept Header
```http
GET /about HTTP/1.1
Host: example.com
Accept: text/markdown
```

### 2. URL Path Extension
```http
GET /about.md HTTP/1.1
Host: example.com
```

### 3. Query Parameter
```http
GET /about?format=md HTTP/1.1
Host: example.com
```

---

## 2. Precedence Order

When multiple indicators exist on the same request, AgentContent applies deterministic precedence:

```
Explicit Query Parameter (?format=md)
         ↓ (if absent)
Explicit URL Extension (/about.md)
         ↓ (if absent)
HTTP Accept Header (Accept: text/markdown)
         ↓ (if absent)
Default Fallback (HTML)
```

### Quality Values (`q`) and Edge Cases
1. **RFC 9110 Quality Sorting**: Media types in the `Accept` header are evaluated by `q` value (0.0 to 1.0).
2. **`q=0` Rejection**: `text/markdown;q=0` explicitly forbids Markdown delivery and will **never** trigger Markdown.
3. **Browser Wildcard Safety**: Standard browser Accept headers typically include `*/*;q=0.8`. AgentContent **never** selects Markdown solely because `*/*` matches; Markdown requires an explicit `text/markdown` declaration or higher priority than HTML.
4. **Vary Header Optimization**:
   - When Markdown is served due to the `Accept` header, the response **must** include `Vary: Accept`.
   - When Markdown is served due to `/about.md` or `?format=md`, `Vary: Accept` is **omitted**, allowing CDNs to cache by URI.

---

## 3. Response Headers

Standard Markdown response from AgentContent:

```http
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Vary: Accept
X-Content-Type-Options: nosniff
ETag: W/"md-4f8a3bc9e12"
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
Last-Modified: Sun, 01 Nov 2026 10:00:00 GMT
```

