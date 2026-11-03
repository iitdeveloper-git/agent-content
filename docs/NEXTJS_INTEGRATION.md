# Next.js Integration Guide

AgentContent provides first-class, single-package support for the Next.js App Router across Next.js 14.x, 15.x, and 16.x.

---

## 1. Installation

A Next.js developer needs only one package:

```bash
npm install @iitdeveloper/agent-content-nextjs
```

`@iitdeveloper/agent-content-nextjs` automatically includes and re-exports all core AgentContent utilities (`defineAgentContent`, `htmlToMarkdown`, etc.).

---

## 2. Setting Up Content Repository

Create `agent-content.config.ts`:

```typescript
import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';

export const agentContent = defineAgentContent({
  site: {
    name: 'My Next.js Application',
    url: 'https://example.com',
    description: 'AI-readable documentation and pages.',
  },
  pages: [
    {
      url: '/about',
      title: 'About Us',
      description: 'Overview of our platform and team.',
      content: '# About Us\n\nWe build next-generation developer tools.',
      status: 'published',
    },
  ],
});
```

---

## 3. Catch-All Agent Route Handler

Create `app/api/agent-content/[...slug]/route.ts`:

```typescript
import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createAgentContentHandler({
  content: agentContent,
  // Optional: fallback function to convert dynamic Next.js page HTML
  fallbackHtml: async (request, canonicalPath) => {
    const res = await fetch(`http://localhost:3000${canonicalPath}`);
    return res.text();
  },
});
```

The handler automatically resolves dynamic route parameters (supporting sync params in Next 14 and async params in Next 15/16) and automatically strips the `/api/agent-content` mount prefix.

---

## 4. Exposing Discovery Endpoints

### `/llms.txt`
Create `app/llms.txt/route.ts`:

```typescript
import { createLlmsTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createLlmsTxtHandler(agentContent);
```

### `/llms-full.txt`
Create `app/llms-full.txt/route.ts`:

```typescript
import { createLlmsFullTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createLlmsFullTxtHandler(agentContent);
```

---

## 5. Clean URL Routing (Rewrites)

If you prefer clean URLs (`/about.md` or `/about` with `Accept: text/markdown`) without forcing clients to prefix with `/api/agent-content`, add a lightweight routing rewrite:

### Next.js 16 (`proxy.ts`)

In Next.js 16, routing rewrites are configured in `proxy.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs/proxy';

export default function proxy(request: NextRequest) {
  const decision = shouldRewriteToMarkdown(request);

  if (decision.rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/agent-content${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
```

### Next.js 14 & 15 (`middleware.ts`)

In Next.js 14 and 15:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs/proxy';

export function middleware(request: NextRequest) {
  const decision = shouldRewriteToMarkdown(request);

  if (decision.rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/agent-content${request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Why `/proxy`?

Import `shouldRewriteToMarkdown` from `@iitdeveloper/agent-content-nextjs/proxy`, **not** the package root. The `/proxy` entry point depends only on the pure negotiation module, so the Edge Runtime bundle used by Next.js 14/15 `middleware.ts` stays tiny and free of `cheerio`, `turndown`, `yaml`, `zod` and Node built-ins (`node:dns`, `node:crypto`). Importing the root entry in `middleware.ts` bundles the whole engine (100+ kB) and triggers Edge-runtime warnings. Route handlers (`route.ts`) run on the Node.js runtime and import from the package root as usual.

### CDN caching caveat: `Vary: Accept` on Next.js HTML pages

Markdown responses produced by AgentContent send `Vary: Accept` when the format was chosen from the `Accept` header. Next.js, however, **overwrites the `Vary` header of its own HTML page responses** (it emits `Vary: rsc, next-router-state-tree, …, Accept-Encoding`); neither `proxy.ts`/`middleware.ts`, `NextResponse.next({ headers })` nor `next.config` `headers()` can add `Accept` to it (verified on Next.js 14.2, 15.5 and 16.4). If a shared cache sits in front of the app and you serve Markdown from the *same URL* via `Accept`:

- include the `Accept` header in the CDN cache key for those routes (Cloudflare Cache Rules / Fastly `vcl_hash` / CloudFront cache policy / your CDN's equivalent), **or**
- advertise and use the explicit URLs (`/page.md`, `/page?format=md`) for agents — these are keyed by URL and need no `Vary`.

See [CACHING.md](CACHING.md).
