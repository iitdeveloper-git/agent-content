# Netlify Static Hosting Integration

Netlify supports static file serving, custom response headers via `_headers`, and URL rewrites via `_redirects`.

---

## 1. Automated Build Step

Add AgentContent to your build pipeline in `package.json` or Netlify build settings:

```json
{
  "scripts": {
    "build": "build-site && npx @iitdeveloper/cli build --dir ./dist --base-url https://my-site.netlify.app"
  }
}
```

---

## 2. Header Configuration (`_headers`)

Place a `_headers` file in your publish directory (or configure `netlify.toml`):

```text
/*
  X-Content-Type-Options: nosniff

/*.md
  Content-Type: text/markdown; charset=utf-8
  X-Content-Type-Options: nosniff

/llms.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600
```

---

## 3. Query Parameter Rewrites (`_redirects`)

Netlify Edge supports redirecting query parameters:

```text
# Rewrite ?format=md to .md file
/about format=md /about.md 200!
/docs/* format=md /docs/:splat.md 200!
```

---

## 4. Header-Based Content Negotiation via Netlify Edge Functions

For true `Accept: text/markdown` negotiation on Netlify, deploy a lightweight Netlify Edge Function in `netlify/edge-functions/negotiate.ts`:

```ts
import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const accept = request.headers.get('accept') || '';
  const url = new URL(request.url);

  if (accept.includes('text/markdown') && !url.pathname.endsWith('.md')) {
    const mdPath = url.pathname.replace(/\/$/, '') + '.md';
    return context.rewrite(mdPath);
  }

  return context.next();
};
```

