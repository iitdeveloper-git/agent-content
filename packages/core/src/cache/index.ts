import type { CacheOptions } from '../types/index.js';

export interface ConditionalCheckResult {
  /** 304 if cache is fresh; 200 otherwise */
  status: 304 | 200;
  /** Whether the response body should be omitted (true for 304) */
  isNotModified: boolean;
  /** Response headers to emit */
  headers: Record<string, string>;
}

/**
 * Deterministic fast 64-bit hash (FNV-1a with avalanche mixing)
 * Web-standard and Edge-runtime safe (zero Node.js dependencies).
 */
function hashContent(content: string | Uint8Array): string {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  let h1 = 0x811c9dc5;
  let h2 = 0x84222325;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    h1 = Math.imul(h1 ^ b, 0x01000193);
    h2 = Math.imul(h2 ^ b, 0x5bd1e995);
  }
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h2 ^= h2 >>> 16;
  h2 = Math.imul(h2, 0xc2b2ae35);
  h2 ^= h2 >>> 16;

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return hex1 + hex2;
}

/**
 * Generates a representation-specific ETag hash for content.
 * Markdown ETags use the `md-` prefix by default to prevent collision with HTML representations.
 */
export function generateETag(
  content: string | Uint8Array,
  options?: { prefix?: string; weak?: boolean }
): string {
  const prefix = options?.prefix ?? 'md-';
  const isWeak = options?.weak !== false; // Default to weak ETag

  const hash = hashContent(content);
  const tag = `"${prefix}${hash}"`;
  return isWeak ? `W/${tag}` : tag;
}

/**
 * Normalizes an ETag for comparison by stripping 'W/' and wrapping quotes.
 */
function normalizeETag(etag: string): string {
  return etag.trim().replace(/^W\//, '').replace(/^"|"$/g, '');
}

/**
 * Extracts a header value from various header interfaces.
 */
function getHeader(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  name: string
): string | null {
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const lower = name.toLowerCase();

  for (const [key, val] of Object.entries(record)) {
    if (key.toLowerCase() === lower) {
      if (Array.isArray(val)) return val[0] ?? null;
      return typeof val === 'string' ? val : null;
    }
  }

  return null;
}

/**
 * Builds a standardized Cache-Control header string.
 */
export function createCacheControlHeader(options?: CacheOptions): string {
  if (options?.customCacheControl) {
    return options.customCacheControl;
  }

  const isPublic = options?.public !== false;
  const maxAge = options?.maxAge ?? 3600;
  const swr = options?.staleWhileRevalidate ?? 86400;

  const visibility = isPublic ? 'public' : 'private';
  const parts = [visibility, `max-age=${maxAge}`];

  if (swr > 0) {
    parts.push(`stale-while-revalidate=${swr}`);
  }

  return parts.join(', ');
}

/**
 * Formats a Date or date string into an RFC 7231 / RFC 9110 HTTP-date string.
 */
export function formatHttpDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

/**
 * Evaluates conditional HTTP request headers (If-None-Match, If-Modified-Since)
 * against the provided representation ETag and Last-Modified date.
 */
export function handleConditionalRequest(
  requestHeaders: Headers | Record<string, string | string[] | undefined> | undefined,
  currentETag?: string,
  lastModified?: Date | string
): ConditionalCheckResult {
  const headers: Record<string, string> = {};

  if (currentETag) {
    headers['ETag'] = currentETag;
  }

  if (lastModified) {
    headers['Last-Modified'] = formatHttpDate(lastModified);
  }

  // 1. Evaluate If-None-Match (RFC 9110 Section 13.1.2)
  const ifNoneMatch = getHeader(requestHeaders, 'if-none-match');
  if (ifNoneMatch && currentETag) {
    const rawClientTags = ifNoneMatch.split(',').map((t) => t.trim());
    const currentNorm = normalizeETag(currentETag);

    for (const clientTag of rawClientTags) {
      if (clientTag === '*' || normalizeETag(clientTag) === currentNorm) {
        return {
          status: 304,
          isNotModified: true,
          headers,
        };
      }
    }

    // If-None-Match takes precedence over If-Modified-Since
    return {
      status: 200,
      isNotModified: false,
      headers,
    };
  }

  // 2. Evaluate If-Modified-Since if If-None-Match was not present
  const ifModifiedSince = getHeader(requestHeaders, 'if-modified-since');
  if (ifModifiedSince && lastModified) {
    const clientDate = new Date(ifModifiedSince);
    const serverDate = lastModified instanceof Date ? lastModified : new Date(lastModified);

    if (!isNaN(clientDate.getTime()) && !isNaN(serverDate.getTime())) {
      // HTTP dates have 1-second resolution; compare in seconds
      const clientSec = Math.floor(clientDate.getTime() / 1000);
      const serverSec = Math.floor(serverDate.getTime() / 1000);

      if (serverSec <= clientSec) {
        return {
          status: 304,
          isNotModified: true,
          headers,
        };
      }
    }
  }

  return {
    status: 200,
    isNotModified: false,
    headers,
  };
}
