# Vercel Static Hosting Integration

Vercel supports static sites, header configuration, and conditional header rewrites via `vercel.json`.

---

## 1. Automated Build Step

In your build command (e.g. for Astro, Vite, 11ty, or Hugo on Vercel):

```bash
npx @iitdeveloper/cli build --dir ./public --base-url https://example.com
```

---

## 2. Vercel Configuration (`vercel.json`)

Configure `vercel.json` in your repository root:

```json
{
  "headers": [
    {
      "source": "/(.*)\\.md",
      "headers": [
        { "key": "Content-Type", "value": "text/markdown; charset=utf-8" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }
      ]
    },
    {
      "source": "/(llms.*\\.txt)",
      "headers": [
        { "key": "Content-Type", "value": "text/plain; charset=utf-8" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Cache-Control", "value": "public, max-age=3600" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "has": [
        {
          "type": "header",
          "key": "accept",
          "value": ".*text/markdown.*"
        }
      ],
      "destination": "/$1.md"
    },
    {
      "source": "/(.*)",
      "has": [
        {
          "type": "query",
          "key": "format",
          "value": "md"
        }
      ],
      "destination": "/$1.md"
    }
  ]
}
```

### Explanation of Rewrites
- If the incoming request has `Accept: text/markdown`, Vercel Edge automatically rewrites the request from `/about` to `/about.md`.
- If the request has query param `?format=md`, it rewrites to `/about.md`.
- Normal human browser requests continue receiving standard HTML.

