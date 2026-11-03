# @iitdeveloper/agent-content-nextjs

> Next.js App Router integration adapter for AgentContent. Single-package installation with full core functionality re-exported.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/iitdeveloper-git/agent-content/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@iitdeveloper/agent-content-nextjs.svg)](https://www.npmjs.com/package/@iitdeveloper/agent-content-nextjs)

---

## ⚡ What is this?

`@iitdeveloper/agent-content-nextjs` is the official Next.js adapter for **AgentContent**. It provides Next.js App Router route handlers that automatically serve Markdown to AI agents sending `Accept: text/markdown` or requesting `.md` paths, while preserving normal HTML rendering for human web browsers.

**Zero extra packages required:** Installing `@iitdeveloper/agent-content-nextjs` automatically includes the complete AgentContent engine and re-exports all core functions (`defineAgentContent`, `htmlToMarkdown`, etc.).

---

## 📦 Installation

```bash
npm install @iitdeveloper/agent-content-nextjs
```

---

## 🚀 Quickstart

### 1. Define your content repository

Create `agent-content.config.ts`:

```typescript
import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';

export const content = defineAgentContent({
  site: {
    name: 'My Next.js Application',
    url: 'https://example.com',
    description: 'AI-readable full-stack application.',
  },
  pages: [
    {
      url: '/about',
      title: 'About Us',
      description: 'Learn about our platform and vision.',
      content: '# About Us\n\nWe build next-generation AI infrastructure.',
      status: 'published',
    },
  ],
});
```

### 2. Add Catch-All Agent Route Handler

Create `app/api/agent-content/[...slug]/route.ts`:

```typescript
import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { content } from '@/agent-content.config';

export const { GET, HEAD } = createAgentContentHandler({
  content,
  // Optional: Dynamic fallback renderer for dynamic Next.js React pages
  fallbackHtml: async (request, canonicalPath) => {
    const res = await fetch(`http://localhost:3000${canonicalPath}`);
    return res.text();
  },
});
```

### 3. Expose Discovery Endpoints

Create `app/llms.txt/route.ts`:

```typescript
import { createLlmsTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { content } from '@/agent-content.config';

export const { GET, HEAD } = createLlmsTxtHandler(content);
```

Create `app/llms-full.txt/route.ts`:

```typescript
import { createLlmsFullTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { content } from '@/agent-content.config';

export const { GET, HEAD } = createLlmsFullTxtHandler(content);
```

---

## 🧭 Clean URL Rewrites (Next.js 14, 15 & 16)

### Next.js 16 (`proxy.ts`)

In Next.js 16, use `proxy.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  const pathname = request.nextUrl.pathname;

  if (accept.includes('text/markdown') || pathname.endsWith('.md')) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/agent-content${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
```

### Next.js 14 & 15 (`middleware.ts`)

In `middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  const pathname = request.nextUrl.pathname;

  if (accept.includes('text/markdown') || pathname.endsWith('.md')) {
    const url = request.nextUrl.clone();
    url.pathname = `/api/agent-content${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 📄 License

Apache License 2.0. Copyright (c) IITDEVELOPER.

