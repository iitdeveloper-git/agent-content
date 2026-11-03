# Single Source of Truth

Keep **one typed content model** and derive both your website and your AgentContent output from it. No page text is written twice.

```
content/site.ts  ──►  React / Next.js pages   (human HTML, generateMetadata, static params)
   (typed model) ─►  toStructuredPage()  ──►  AgentContent  (Markdown, llms.txt, /page.md)
```

AgentContent needs no special API for this. `defineAgentContent({ pages })` takes plain `StructuredPage` objects, so you only write a small mapper. A complete runnable app lives in [`examples/single-source-of-truth`](../examples/single-source-of-truth); it is also exercised by `tests/integration/single-source.test.ts`.

## 1. The shared model (outside `agent-content.config.ts`)

Plain, typed data. No React, no AgentContent imports.

```typescript
// content/types.ts
export type Block = { kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] };
export interface Section { heading: string; blocks: Block[] }
export interface SiteItem {
  path: string; title: string; summary: string;
  status: 'published' | 'draft'; updatedAt: string; category: string;
  sections: Section[];
}

// content/site.ts
export const ITEMS: SiteItem[] = [
  { path: '/services', title: 'Services', summary: 'Web development and AI integration.',
    status: 'published', updatedAt: '2026-11-02', category: 'Offerings',
    sections: [{ heading: 'Web development', blocks: [
      { kind: 'paragraph', text: 'Fast, accessible sites.' },
      { kind: 'list', items: ['Design systems', 'SEO'] },
    ] }] },
  // ...
];
```

Model content as **structured data** (blocks, sections), not Markdown strings. The same blocks become JSX for people and Markdown for agents.

## 2. Render the website from the model

UI components and styling stay in your app; AgentContent never imports them.

```tsx
// components/ItemPage.tsx
export function ItemPage({ item }: { item: SiteItem }) {
  return (
    <main>
      <h1>{item.title}</h1>
      {item.sections.map((s) => <SectionView key={s.heading} section={s} />)}
    </main>
  );
}
```

## 3. Map the model to `StructuredPage`

```typescript
// content/to-structured-page.ts
import type { StructuredPage } from '@iitdeveloper/agent-content-nextjs';

export function toStructuredPage(item: SiteItem): StructuredPage {
  return {
    url: item.path,
    title: item.title,
    description: item.summary,
    content: '',                                   // body is carried by `sections`
    sections: item.sections.map((s) => ({
      title: s.heading, level: 2,
      content: s.blocks.map(blockToMarkdown).join('\n\n'),
    })),
    category: item.category,
    status: item.status,
    updatedAt: item.updatedAt,
  };
}
```

This function is the only place that knows both shapes. It is pure data in, pure data out, so it is trivial to unit test.

## 4. Initialise AgentContent from the model

```typescript
// agent-content.config.ts
import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';
import { ITEMS, SITE } from './content/site';
import { toStructuredPage } from './content/to-structured-page';

export const agentContent = defineAgentContent({
  site: SITE,
  pages: ITEMS.map(toStructuredPage),
});
```

## 5. One list of routes: `listPages({ status: 'published' })`

```tsx
// app/[slug]/page.tsx
export const dynamicParams = false;

export function generateStaticParams() {
  return agentContent
    .listPages({ status: 'published' })
    .filter((p) => p.url !== '/')
    .map((p) => ({ slug: p.url.slice(1) }));
}
```

Drafts are excluded from HTML routes, `/page.md`, `llms.txt` and `llms-full.txt` by the same status flag.

## 6. Next.js metadata from the same source

```tsx
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getItem(`/${(await params).slug}`);
  return item ? { title: item.title, description: item.summary } : {};
}
```

## 7. Output

`GET /services` with `Accept: text/markdown` (or `/services.md`):

```markdown
---
title: Services
description: Web development, data pipelines and AI integration.
canonical_url: https://acme.example/services
updated_at: 2026-11-02
category: Offerings
---

## Web development

Fast, accessible sites built on React and Next.js.

- Design systems
- Performance budgets
- SEO
```

## Optional: `metadata` and `structuredData` in Markdown

`StructuredPage.metadata` and `StructuredPage.structuredData` are validated and stored, but **not rendered unless you opt in**. Default output is byte-identical to earlier releases.

```typescript
defineAgentContent({
  site, pages,
  render: { includeMetadata: true, includeStructuredData: true },  // both default to false
});
```

(`renderStructuredPageToMarkdown(page, siteUrl, options)` accepts the same options as a third argument.)

### `includeMetadata`

Emitted as **one nested `metadata:` key** at the end of the YAML frontmatter, so it can never collide with or duplicate reserved keys (`title`, `canonical_url`, ...).

```yaml
---
title: Services
canonical_url: https://s.test/services
metadata:
  audience: developers
  pricing:
    currency: USD
    from: 100
---
```

### `includeStructuredData`

Appended once, after the body, as a fenced block with the info string `jsonld`:

````markdown
```jsonld
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Services"
}
```
````

### Validation and safety rules

Both fields are validated before they are emitted. An invalid value is **omitted silently**; it never makes a request fail and never produces partial output.

- Accepted: plain objects, arrays, strings, finite numbers, booleans, `null`, and `Date` (serialised as ISO-8601). Everything else (functions, symbols, `bigint`, class instances such as `Map`, `NaN`/`Infinity`, cycles) invalidates the field.
- Limits: nesting depth 16, serialised size 64 KiB, non-empty object.
- `structuredData` must also contain an `@type` or `@graph`. If `@context` is absent, `"@context": "https://schema.org"` is added as the first key; a caller-supplied `@context` (string or object/array) is kept.
- The JSON is pretty-printed with `` ` ``, `<`, `>` and `&` written as `\uXXXX` escapes. The parsed value is unchanged, but the content can neither close the Markdown fence nor form HTML if someone extracts the block and inlines it.
- Content is never emitted as raw HTML; there is no `<script>` tag.

### Limitations

- `llms.txt` and `llms-full.txt` list titles, descriptions and bodies only. They do not include `metadata` or `structuredData`.
- Only the Markdown representation is affected. Your HTML pages keep emitting their own JSON-LD (for example in a `<script type="application/ld+json">` rendered by your app); share the same data between both if you want them identical.
- Unknown top-level `StructuredPage` keys are dropped at registration. Put custom fields under `metadata`.
- A JSX-only page cannot be converted automatically. Model the content as data (as above) or write Markdown.

## Checklist

- [ ] Content lives in one typed module with no framework imports.
- [ ] Pages render from that module.
- [ ] `agent-content.config.ts` contains no page text, only `ITEMS.map(toStructuredPage)`.
- [ ] `generateStaticParams` uses `listPages({ status: 'published' })`.
- [ ] `generateMetadata` reads the same model.
- [ ] A test asserts the mapper's output for at least one page.
