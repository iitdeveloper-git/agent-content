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

In Next.js 14 and 15:

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
