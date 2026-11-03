# AgentContent Configuration Reference

Complete reference for all options accepted by `defineAgentContent` and framework adapters.

---

## Configuration Schema

```ts
interface AgentContentConfig {
  site: SiteConfig;
  pages?: StructuredPage[];
  negotiation?: Partial<NegotiationOptions>;
  markdown?: HtmlToMarkdownOptions;
  cache?: CacheOptions;
  security?: SecurityOptions;
}
```

---

## 1. `site` (Required)

| Property | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | **Yes** | Human-readable title of your website or service. |
| `url` | `string` | **Yes** | Fully qualified base URL (e.g. `https://example.com`). |
| `description`| `string` | No | Short summary or tagline. Included in `llms.txt`. |
| `language` | `string` | No | Default ISO 639-1 language code (e.g. `'en'`). |
| `author` | `string` | No | Organization or default author name. |

---

## 2. `pages` (Structured Pages)

| Property | Type | Description |
| :--- | :--- | :--- |
| `url` | `string` | Page route path (e.g. `'/docs/install'`). Normalized automatically. |
| `title` | `string` | Page title. |
| `description`| `string` | Meta description or short summary. |
| `content` | `string` | Primary Markdown body. |
| `sections` | `Array<{ title, content, level }>` | Structured sections appended to the body. |
| `canonicalUrl`| `string` | Canonical URL override. Defaults to `site.url + page.url`. |
| `language` | `string` | Page language code. |
| `publishedAt`| `string \| Date` | Publication date. |
| `updatedAt` | `string \| Date` | Last updated date. Used for `Last-Modified` and 304 checks. |
| `authors` | `string[]` | List of author names. |
| `tags` | `string[]` | Search and categorization tags. |
| `category` | `string` | Section group in `llms.txt` (e.g. `'Documentation'`). |
| `status` | `'published' \| 'draft' \| 'archived'` | Defaults to `'published'`. Drafts are never served publicly. |

---

## 3. `negotiation` (Content Negotiation Options)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `queryParam` | `string` | `'format'` | Query parameter key for explicit format selection. |
| `enableExtensionSuffix` | `boolean` | `true` | Whether to recognize `/page.md` as Markdown request. |
| `defaultFormat` | `'html' \| 'markdown'` | `'html'` | Fallback format when no preference is detected. |
| `minQualityThreshold` | `number` | `0.001` | Minimum Accept header `q` value. `q=0` is always rejected. |

---

## 4. `markdown` (HTML Conversion Options)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `excludeSelectors` | `string[]` | Standard clutter | CSS selectors to remove (`nav`, `footer`, `script`, `.cookie-banner`). |
| `contentSelector` | `string` | Auto (`main, article, body`) | Primary container selector. |
| `baseUrl` | `string` | `undefined` | Resolves relative links and images into absolute URLs. |
| `headingStyle` | `'atx' \| 'setext'`| `'atx'` | Heading format style (`# Heading`). |
| `codeBlockStyle` | `'fenced' \| 'indented'` | `'fenced'` | Code block style (` ``` `). |
| `includeFrontmatter` | `boolean` | `false` | Prepends YAML frontmatter extracted from HTML metadata. |
| `maxInputSizeBytes` | `number` | `5242880` (5MB) | Maximum allowable HTML input size in bytes. |

---

## 5. `cache` (HTTP Caching Options)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxAge` | `number` | `3600` | `Cache-Control` max-age in seconds (1 hour). |
| `staleWhileRevalidate` | `number` | `86400` | SWR grace period in seconds (24 hours). |
| `public` | `boolean` | `true` | Emits `public` or `private` cache visibility. |
| `etagPrefix` | `string` | `'md-'` | Prefix for Markdown ETags (`W/"md-..."`). |

---

## 6. `security` (Security Options)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxRequestSizeBytes` | `number` | `5242880` (5MB) | Request payload ceiling. |
| `maxOutputSizeBytes` | `number` | `10485760` (10MB)| Response body ceiling. |
| `ssrfProtection` | `boolean` | `true` | Forbids private IP, loopback, and metadata requests. |
| `allowedHosts` | `string[]` | `undefined` | Strict host allowlist for remote fetching. |
| `requestTimeoutMs` | `number` | `5000` | Timeout for outbound HTTP requests in ms. |

