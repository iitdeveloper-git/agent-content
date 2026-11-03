# Next.js App Router Integration Example

Demonstrates how to integrate `@iitdeveloper/agent-content-nextjs` into a Next.js 14, 15, or 16 application using App Router Route Handlers.

## Folder Structure
```
app/
├── api/agent-content/[[...slug]]/
│   └── route.ts         # Handles Markdown requests, ?format=md, and conditional caching
└── llms.txt/
    └── route.ts         # Exposes standard /llms.txt discovery file
```

## Setup & Usage

```ts
// app/api/agent-content/[[...slug]]/route.ts
import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';

export const { GET, HEAD } = createAgentContentHandler({
  content: agentContent,
});
```

