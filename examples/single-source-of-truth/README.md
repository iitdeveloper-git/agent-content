# Single Source of Truth example

One typed content model (`content/site.ts`) renders the website **and** the AgentContent output. See [docs/SINGLE_SOURCE_OF_TRUTH.md](../../docs/SINGLE_SOURCE_OF_TRUTH.md).

| File | Role |
| --- | --- |
| `content/types.ts`, `content/site.ts` | The canonical model (plain data) |
| `content/to-structured-page.ts` | Maps the model to `StructuredPage` |
| `agent-content.config.ts` | `pages: ITEMS.map(toStructuredPage)` |
| `components/`, `app/page.tsx`, `app/[slug]/page.tsx` | React UI, `generateStaticParams`, `generateMetadata` |
| `app/api/agent-content/[[...slug]]/route.ts`, `app/llms.txt/route.ts`, `middleware.ts` | AgentContent routes and clean-URL rewrite |

```bash
pnpm install
pnpm build                                   # build the workspace packages first
pnpm --filter example-single-source-of-truth dev
curl -H 'Accept: text/markdown' localhost:3000/services
curl localhost:3000/services.md
curl localhost:3000/llms.txt
```

The AgentContent route is the **optional** catch-all `[[...slug]]` so that `/` (and `/index.md`) can be served as Markdown too.

CI builds this example from packed tarballs and smoke-tests it over HTTP (`node scripts/verify-example.mjs`).

`/roadmap` is a draft: it returns 404 as HTML and as Markdown and is absent from `llms.txt`.
