import {
  defineAgentContent,
  generateETag,
  generateLlmsFullTxt,
  generateLlmsTxt,
  getRequestedFormat,
  handleConditionalRequest,
  htmlToMarkdown,
  isPathAllowed,
  validateAndNormalizePath,
  createCacheControlHeader,
  formatHttpDate,
  type AgentContentConfig,
  type AgentContentInstance,
  type CacheOptions,
  type NegotiationOptions,
  type SecurityOptions,
} from '@iitdeveloper/agent-content';

// Re-export all core functionality for single-package consumer experience
export * from '@iitdeveloper/agent-content';

export interface NextJsRouteContext {
  params?: Record<string, unknown> | Promise<Record<string, unknown>>;
}

export interface NextJsHandlerOptions {
  /** AgentContent instance or configuration object */
  content: AgentContentInstance | AgentContentConfig;
  /** Custom fallback function to fetch or render HTML if structured page is not registered */
  fallbackHtml?: (request: Request, canonicalPath: string) => Promise<string | Response> | string | Response;
  /** Negotiation options override */
  negotiation?: NegotiationOptions;
  /** Cache options override */
  cache?: CacheOptions;
  /** Security options override */
  security?: SecurityOptions;
  /** Optional URL path prefix to strip (e.g. '/api/agent-content'). Inferred automatically if mounted under /api/agent-content */
  stripPrefix?: string;
}

export interface NextJsRouteHandlers {
  GET: (request: Request, context?: NextJsRouteContext | unknown) => Promise<Response>;
  HEAD: (request: Request, context?: NextJsRouteContext | unknown) => Promise<Response>;
}

/**
 * Creates standard Next.js App Router Route Handlers (GET, HEAD).
 * Supports Next.js 14, 15, and 16 async route params.
 *
 * Usage in `app/api/agent-content/[...slug]/route.ts`:
 * ```ts
 * import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
 * import { content } from '@/agent-content.config';
 *
 * export const { GET, HEAD } = createAgentContentHandler({ content });
 * ```
 */
export function createAgentContentHandler(options: NextJsHandlerOptions): NextJsRouteHandlers {
  const instance: AgentContentInstance =
    'registry' in options.content
      ? options.content
      : defineAgentContent(options.content);

  const handler = async (
    request: Request,
    method: 'GET' | 'HEAD',
    context?: unknown
  ): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Resolve dynamic route params if mounted in Next.js App Router catch-all [...slug]
    let dynamicSlugPath: string | null = null;
    if (context && typeof context === 'object' && 'params' in context) {
      const rawParams = (context as { params: unknown }).params;
      const resolvedParams = rawParams instanceof Promise ? await rawParams : rawParams;
      if (resolvedParams && typeof resolvedParams === 'object' && 'slug' in resolvedParams) {
        const slug = (resolvedParams as { slug: unknown }).slug;
        const parts = Array.isArray(slug) ? slug : typeof slug === 'string' ? [slug] : [];
        if (parts.length > 0) {
          dynamicSlugPath = '/' + parts.map(String).join('/');
        }
      }
    }

    // Determine target relative path for content negotiation and resolution
    let relativePath = pathname;
    if (dynamicSlugPath) {
      relativePath = dynamicSlugPath;
    } else if (typeof options.stripPrefix === 'string') {
      if (pathname.startsWith(options.stripPrefix)) {
        relativePath = pathname.slice(options.stripPrefix.length) || '/';
      }
    } else if (pathname.startsWith('/api/agent-content')) {
      // Default convention: strip /api/agent-content prefix if mounted there
      relativePath = pathname.slice('/api/agent-content'.length) || '/';
    }

    // 2. Check for standard discovery endpoints: /llms.txt and /llms-full.txt
    if (relativePath === '/llms.txt' || pathname === '/llms.txt' || pathname.endsWith('/llms.txt')) {
      const body = generateLlmsTxt({
        site: instance.config.site,
        pages: instance.listPages({ status: 'published' }),
      });
      const etag = generateETag(body, { prefix: 'llms-' });
      const cond = handleConditionalRequest(request.headers, etag);

      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': createCacheControlHeader(options.cache ?? instance.config.cache),
        ...cond.headers,
      };

      if (cond.isNotModified) {
        return new Response(null, { status: 304, headers });
      }

      return new Response(method === 'HEAD' ? null : body, {
        status: 200,
        headers,
      });
    }

    if (relativePath === '/llms-full.txt' || pathname === '/llms-full.txt' || pathname.endsWith('/llms-full.txt')) {
      const body = generateLlmsFullTxt({
        site: instance.config.site,
        pages: instance.listPages({ status: 'published' }),
      });
      const etag = generateETag(body, { prefix: 'llms-full-' });
      const cond = handleConditionalRequest(request.headers, etag);

      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': createCacheControlHeader(options.cache ?? instance.config.cache),
        ...cond.headers,
      };

      if (cond.isNotModified) {
        return new Response(null, { status: 304, headers });
      }

      return new Response(method === 'HEAD' ? null : body, {
        status: 200,
        headers,
      });
    }

    // 3. Perform Content Negotiation using target URL
    const targetUrl = new URL(relativePath + url.search, url.origin).toString();
    const negOptions = options.negotiation ?? instance.config.negotiation;
    const formatResult = getRequestedFormat(targetUrl, request.headers, negOptions);

    // If request is not asking for Markdown, return 404 with Vary: Accept if negotiated
    if (formatResult.format !== 'markdown') {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      };
      if (formatResult.shouldVaryAccept) {
        headers['Vary'] = 'Accept';
      }
      return new Response('Content not found or HTML format not handled by agent endpoint.', {
        status: 404,
        headers,
      });
    }

    // 4. Path Security & Normalization
    let cleanPath: string;
    try {
      cleanPath = validateAndNormalizePath(formatResult.canonicalPath);
    } catch {
      return new Response('Invalid request path.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      });
    }

    // 4b. Security allowedPaths check
    const secOptions = options.security ?? instance.config.security;
    if (secOptions?.allowedPaths && secOptions.allowedPaths.length > 0) {
      if (!isPathAllowed(cleanPath, secOptions.allowedPaths)) {
        return new Response('Path not allowed.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
        });
      }
    }

    // 5. Resolve Content (Structured first, fallback HTML second)
    let markdownBody: string | undefined;
    let isFallbackRendered = false;
    const page = instance.getPage(cleanPath);

    if (page && page.status === 'published') {
      markdownBody = instance.getMarkdown(cleanPath);
    } else if (options.fallbackHtml) {
      try {
        const fallbackRes = await options.fallbackHtml(request, cleanPath);
        const rawHtml =
          typeof fallbackRes === 'string' ? fallbackRes : await fallbackRes.text();
        markdownBody = htmlToMarkdown(rawHtml, {
          ...instance.config.markdown,
          baseUrl: instance.config.site.url,
          includeFrontmatter: true,
        });
        isFallbackRendered = true;
      } catch {
        markdownBody = undefined;
      }
    }

    if (!markdownBody) {
      const notFoundHeaders: Record<string, string> = {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      };
      if (formatResult.shouldVaryAccept) {
        notFoundHeaders['Vary'] = 'Accept';
      }
      return new Response('# 404 Not Found\n\nThe requested document does not exist.', {
        status: 404,
        headers: notFoundHeaders,
      });
    }

    // 6. Caching & Conditional GET Handling (Security S-10: private cache if fallback or auth headers present)
    const etag = generateETag(markdownBody, { prefix: options.cache?.etagPrefix ?? 'md-' });
    const lastModified = page?.updatedAt ?? page?.publishedAt;
    const cond = handleConditionalRequest(request.headers, etag, lastModified);

    const hasAuth = Boolean(request.headers.get('authorization') || request.headers.get('cookie'));
    const effectiveCacheOptions: CacheOptions = {
      ...(options.cache ?? instance.config.cache),
      public: (options.cache?.public !== undefined)
        ? options.cache.public
        : !(isFallbackRendered || hasAuth),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': createCacheControlHeader(effectiveCacheOptions),
      ...cond.headers,
    };

    if (formatResult.shouldVaryAccept) {
      headers['Vary'] = 'Accept';
    }

    if (lastModified) {
      headers['Last-Modified'] = formatHttpDate(lastModified);
    }

    if (cond.isNotModified) {
      return new Response(null, { status: 304, headers });
    }

    // 7. Return response (empty body for HEAD)
    return new Response(method === 'HEAD' ? null : markdownBody, {
      status: 200,
      headers,
    });
  };

  return {
    GET: (request: Request, context?: unknown) => handler(request, 'GET', context),
    HEAD: (request: Request, context?: unknown) => handler(request, 'HEAD', context),
  };
}

/**
 * Creates dedicated Next.js App Router Route Handlers for `/llms.txt`.
 */
export function createLlmsTxtHandler(
  content: AgentContentInstance | AgentContentConfig
): NextJsRouteHandlers {
  const instance = 'registry' in content ? content : defineAgentContent(content);

  const getBody = () =>
    generateLlmsTxt({
      site: instance.config.site,
      pages: instance.listPages({ status: 'published' }),
    });

  return {
    GET: async () =>
      new Response(getBody(), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }),
    HEAD: async () =>
      new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }),
  };
}

/**
 * Creates dedicated Next.js App Router Route Handlers for `/llms-full.txt`.
 */
export function createLlmsFullTxtHandler(
  content: AgentContentInstance | AgentContentConfig
): NextJsRouteHandlers {
  const instance = 'registry' in content ? content : defineAgentContent(content);

  const getBody = () =>
    generateLlmsFullTxt({
      site: instance.config.site,
      pages: instance.listPages({ status: 'published' }),
    });

  return {
    GET: async () =>
      new Response(getBody(), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }),
    HEAD: async () =>
      new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      }),
  };
}
