# Basic Node.js Integration Example

Demonstrates integrating `@iitdeveloper/agent-content-node` and `@iitdeveloper/agent-content` with a standard Node.js HTTP or Express server.

## Features Shown
- Content negotiation via `Accept: text/markdown`
- Direct Markdown route via `/page.md`
- Query parameter override via `?format=md`
- Automatic discovery endpoints `/llms.txt` and `/llms-full.txt`
- Transparent fallthrough to HTML for human browsers

## Running the Example

```bash
pnpm start
```

