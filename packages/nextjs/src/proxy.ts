import { getRequestedFormat } from '@iitdeveloper/agent-content/negotiation';
import type { NegotiationOptions } from '@iitdeveloper/agent-content/types';

/*
 * Lightweight entry point for Next.js `proxy.ts` / `middleware.ts`.
 *
 * It deliberately imports ONLY the pure negotiation module of the core package so that the Edge
 * Runtime bundle used by Next.js 14/15 `middleware.ts` does not pull in cheerio, turndown, yaml,
 * zod or any Node built-in (`node:dns`, `node:crypto`, ...).
 */

export interface ShouldRewriteResult {
  /** Whether the request should be rewritten to the AgentContent Markdown handler */
  rewrite: boolean;
  /**
   * True when the representation of this URL depends on the `Accept` header. Next.js overwrites the
   * `Vary` header of its own page responses, so this cannot be applied from `proxy.ts`/`middleware.ts`;
   * use it to configure the CDN cache key instead (see docs/CACHING.md).
   */
  shouldVaryAccept: boolean;
  /** Suggested rewritten path if rewrite is true */
  rewritePath?: string;
}

/**
 * Determines whether an incoming Next.js request should be rewritten to Markdown.
 * Evaluates RFC 9111 q-values (rejects q=0), `.md` URL paths, and `?format=md` parameters.
 *
 * Usage in `proxy.ts` (Next 16) or `middleware.ts` (Next 14/15):
 * ```ts
 * import { NextResponse, type NextRequest } from 'next/server';
 * import { shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs/proxy';
 *
 * export default function proxy(request: NextRequest) {
 *   const decision = shouldRewriteToMarkdown(request);
 *   if (decision.rewrite) {
 *     const url = request.nextUrl.clone();
 *     url.pathname = `/api/agent-content${request.nextUrl.pathname}`;
 *     return NextResponse.rewrite(url);
 *   }
 *   return NextResponse.next();
 * }
 * ```
 */
export function shouldRewriteToMarkdown(
  request: Request | { headers: Headers | { get(name: string): string | null } | Record<string, string | string[] | undefined>; url: string },
  options?: {
    negotiation?: NegotiationOptions;
    apiPrefix?: string;
  }
): ShouldRewriteResult {
  const urlStr = typeof request.url === 'string' ? request.url : String(request.url);
  const decision = getRequestedFormat(urlStr, request.headers as Headers, options?.negotiation);
  const isMarkdown = decision.format === 'markdown';

  let rewritePath: string | undefined;
  if (isMarkdown) {
    const apiPrefix = options?.apiPrefix ?? '/api/agent-content';
    const parsed = new URL(urlStr, 'http://localhost');
    rewritePath = `${apiPrefix}${parsed.pathname}${parsed.search}`;
  }

  return {
    rewrite: isMarkdown,
    shouldVaryAccept: decision.shouldVaryAccept,
    rewritePath,
  };
}

