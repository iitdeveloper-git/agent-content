import type { IncomingMessage, ServerResponse } from 'http';
import {
  appendVaryHeader,
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

export interface NodeHandlerOptions {
  /** AgentContent instance or configuration */
  content: AgentContentInstance | AgentContentConfig;
  /** Fallback function returning HTML string if path not found in structured registry */
  fallbackHtml?: (urlOrPath: string, req: IncomingMessage) => Promise<string> | string;
  /** Negotiation options override */
  negotiation?: NegotiationOptions;
  /** Cache options override */
  cache?: CacheOptions;
  /** Security options override */
  security?: SecurityOptions;
}

/**
 * Standard Express/Connect middleware for AgentContent.
 *
 * If the request demands Markdown (via Accept: text/markdown, ?format=md, or .md),
 * this middleware intercepts and serves the structured Markdown representation.
 *
 * If the request is for normal HTML, it sets Vary: Accept (if negotiated) and calls `next()`,
 * allowing normal browser rendering to continue without disruption.
 */
export function createNodeMiddleware(options: NodeHandlerOptions) {
  const instance: AgentContentInstance =
    'registry' in options.content
      ? options.content
      : defineAgentContent(options.content);

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ): Promise<void> => {
    try {
      const rawUrl = req.url || '/';
      const [pathname = '/'] = rawUrl.split('?');

      // 1. Discovery endpoints: /llms.txt and /llms-full.txt
      if (pathname === '/llms.txt' || pathname.endsWith('/llms.txt')) {
        const body = generateLlmsTxt({
          site: instance.config.site,
          pages: instance.listPages({ status: 'published' }),
        });
        const etag = generateETag(body, { prefix: 'llms-' });
        const cond = handleConditionalRequest(req.headers, etag);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', createCacheControlHeader(options.cache ?? instance.config.cache));
        res.setHeader('ETag', etag);

        if (cond.isNotModified) {
          res.statusCode = 304;
          res.end();
          return;
        }

        res.statusCode = 200;
        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(body);
        }
        return;
      }

      if (pathname === '/llms-full.txt' || pathname.endsWith('/llms-full.txt')) {
        const body = generateLlmsFullTxt({
          site: instance.config.site,
          pages: instance.listPages({ status: 'published' }),
        });
        const etag = generateETag(body, { prefix: 'llms-full-' });
        const cond = handleConditionalRequest(req.headers, etag);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', createCacheControlHeader(options.cache ?? instance.config.cache));
        res.setHeader('ETag', etag);

        if (cond.isNotModified) {
          res.statusCode = 304;
          res.end();
          return;
        }

        res.statusCode = 200;
        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(body);
        }
        return;
      }

      // 2. Perform Content Negotiation
      const negOptions = options.negotiation ?? instance.config.negotiation;
      const formatResult = getRequestedFormat(rawUrl, req.headers, negOptions);

      // If format is not markdown, pass through to next middleware/HTML renderer with Vary: Accept if negotiated
      if (formatResult.format !== 'markdown') {
        if (formatResult.shouldVaryAccept) {
          const curVary = res.getHeader('Vary');
          res.setHeader('Vary', appendVaryHeader(typeof curVary === 'string' ? curVary : undefined, 'Accept'));
        }
        return next();
      }

      // 3. Path Security & Normalization
      let cleanPath: string;
      try {
        cleanPath = validateAndNormalizePath(formatResult.canonicalPath);
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.end('Invalid request path.');
        return;
      }

      // 3b. Security allowedPaths check
      const secOptions = options.security ?? instance.config.security;
      if (secOptions?.allowedPaths && secOptions.allowedPaths.length > 0) {
        if (!isPathAllowed(cleanPath, secOptions.allowedPaths)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.end('Path not allowed.');
          return;
        }
      }

      // 4. Resolve Content
      let markdownBody: string | undefined;
      let isFallbackRendered = false;
      const page = instance.getPage(cleanPath);

      if (page && page.status === 'published') {
        markdownBody = instance.getMarkdown(cleanPath);
      } else if (options.fallbackHtml) {
        try {
          const rawHtml = await options.fallbackHtml(cleanPath, req);
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
        // If not found in AgentContent, pass through to application next() handler
        if (formatResult.shouldVaryAccept) {
          const curVary = res.getHeader('Vary');
          res.setHeader('Vary', appendVaryHeader(typeof curVary === 'string' ? curVary : undefined, 'Accept'));
        }
        return next();
      }

      // 5. Caching & Conditional Request (Security S-10: private cache if fallback or auth headers present)
      const etag = generateETag(markdownBody, { prefix: options.cache?.etagPrefix ?? 'md-' });
      const lastModified = page?.updatedAt ?? page?.publishedAt;
      const cond = handleConditionalRequest(req.headers, etag, lastModified);

      const hasAuth = Boolean(req.headers['authorization'] || req.headers['cookie']);
      const effectiveCacheOptions: CacheOptions = {
        ...(options.cache ?? instance.config.cache),
        public: options.cache?.public !== undefined
          ? options.cache.public
          : !(isFallbackRendered || hasAuth),
      };

      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', createCacheControlHeader(effectiveCacheOptions));
      res.setHeader('ETag', etag);

      if (formatResult.shouldVaryAccept) {
        const curVary = res.getHeader('Vary');
        res.setHeader('Vary', appendVaryHeader(typeof curVary === 'string' ? curVary : undefined, 'Accept'));
      }

      if (lastModified) {
        res.setHeader('Last-Modified', formatHttpDate(lastModified));
      }

      if (cond.isNotModified) {
        res.statusCode = 304;
        res.end();
        return;
      }

      res.statusCode = 200;
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(markdownBody);
      }
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Web Standard Fetch API handler for modern JavaScript runtimes (Node 18+, Bun, Deno, Cloudflare Workers).
 */
export function createFetchHandler(options: NodeHandlerOptions) {
  const instance: AgentContentInstance =
    'registry' in options.content
      ? options.content
      : defineAgentContent(options.content);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Discovery endpoints
    if (pathname === '/llms.txt' || pathname.endsWith('/llms.txt')) {
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

      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers,
      });
    }

    if (pathname === '/llms-full.txt' || pathname.endsWith('/llms-full.txt')) {
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

      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers,
      });
    }

    // Content Negotiation
    const formatResult = getRequestedFormat(
      request.url,
      request.headers,
      options.negotiation ?? instance.config.negotiation
    );

    if (formatResult.format !== 'markdown') {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      };
      if (formatResult.shouldVaryAccept) {
        headers['Vary'] = 'Accept';
      }
      return new Response('Not Found or HTML not handled', { status: 404, headers });
    }

    let cleanPath: string;
    try {
      cleanPath = validateAndNormalizePath(formatResult.canonicalPath);
    } catch {
      return new Response('Invalid request path.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
      });
    }

    // Security allowedPaths check
    const secOptions = options.security ?? instance.config.security;
    if (secOptions?.allowedPaths && secOptions.allowedPaths.length > 0) {
      if (!isPathAllowed(cleanPath, secOptions.allowedPaths)) {
        return new Response('Path not allowed.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
        });
      }
    }

    const page = instance.getPage(cleanPath);
    const markdownBody = page && page.status === 'published' ? instance.getMarkdown(cleanPath) : undefined;

    if (!markdownBody) {
      const notFoundHeaders: Record<string, string> = {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      };
      if (formatResult.shouldVaryAccept) {
        notFoundHeaders['Vary'] = 'Accept';
      }
      return new Response('# 404 Not Found\n\nDocument not found.', {
        status: 404,
        headers: notFoundHeaders,
      });
    }

    const etag = generateETag(markdownBody, { prefix: options.cache?.etagPrefix ?? 'md-' });
    const cond = handleConditionalRequest(request.headers, etag, page?.updatedAt);

    const hasAuth = Boolean(request.headers.get('authorization') || request.headers.get('cookie'));
    const effectiveCacheOptions: CacheOptions = {
      ...(options.cache ?? instance.config.cache),
      public: options.cache?.public !== undefined ? options.cache.public : !hasAuth,
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

    if (cond.isNotModified) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(request.method === 'HEAD' ? null : markdownBody, {
      status: 200,
      headers,
    });
  };
}
