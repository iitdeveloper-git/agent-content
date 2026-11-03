import type {
  ContentFormat,
  NegotiatedFormatResult,
  NegotiationOptions,
} from '../types/index.js';

export interface ParsedMediaType {
  mediaType: string;
  type: string;
  subtype: string;
  quality: number;
  specificity: number;
  params: Record<string, string>;
}

const DEFAULT_QUERY_VALUE_MAP: Record<string, ContentFormat> = {
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  raw: 'raw',
};

/**
 * Parses an HTTP Accept header string into a prioritized list of media types.
 * Respects RFC 9110 quality values (q=0 to q=1) and specificity.
 */
export function parseAcceptHeader(acceptHeader?: string | null): ParsedMediaType[] {
  if (!acceptHeader || typeof acceptHeader !== 'string') {
    return [];
  }

  const entries: ParsedMediaType[] = [];
  const clauses = acceptHeader.split(',');

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(';').map((p) => p.trim());
    const rawType = parts[0]?.toLowerCase();
    if (!rawType || !rawType.includes('/')) continue;

    const [type = '', subtype = ''] = rawType.split('/');
    let quality = 1.0;
    const params: Record<string, string> = {};

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim().toLowerCase();
      const val = part.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

      if (key === 'q') {
        const parsedQ = parseFloat(val);
        if (!isNaN(parsedQ)) {
          quality = Math.max(0, Math.min(1, parsedQ));
        }
      } else {
        params[key] = val;
      }
    }

    // Specificity score: type/subtype = 2, type/* = 1, */* = 0
    let specificity = 2;
    if (type === '*' && subtype === '*') {
      specificity = 0;
    } else if (subtype === '*') {
      specificity = 1;
    }

    entries.push({
      mediaType: `${type}/${subtype}`,
      type,
      subtype,
      quality,
      specificity,
      params,
    });
  }

  // Sort: highest quality first; if quality equal, highest specificity first
  return entries.sort((a, b) => {
    if (b.quality !== a.quality) {
      return b.quality - a.quality;
    }
    return b.specificity - a.specificity;
  });
}

/**
 * Appends a header field name to an existing Vary header value without duplicating it.
 * Conforms to RFC 9110 field-value list appending.
 */
export function appendVaryHeader(existingVary: string | null | undefined, field: string): string {
  if (!existingVary || !existingVary.trim()) {
    return field;
  }
  const fields = existingVary.split(',').map((f) => f.trim().toLowerCase());
  if (fields.includes(field.toLowerCase()) || fields.includes('*')) {
    return existingVary;
  }
  return `${existingVary}, ${field}`;
}

/**
 * Strips `.md` extension from a URL path, preserving leading slash and clean canonical form.
 */
export function stripMarkdownExtension(pathname: string): string {
  if (!pathname) return '/';
  const clean = pathname.replace(/\.md$/i, '');
  return clean === '' ? '/' : clean;
}

/**
 * Extracts a header value from various header representations (Fetch Headers, Record, etc.).
 */
function getHeaderValue(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
  headerName: string
): string | null {
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(headerName);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const lowerName = headerName.toLowerCase();

  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lowerName) {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return typeof value === 'string' ? value : null;
    }
  }

  return null;
}

/**
 * Deterministically negotiates the desired content format for a given request.
 *
 * Precedence Order:
 * 1. Explicit query parameter (e.g. ?format=md) -> canonical path stripped, Vary: Accept = false
 * 2. Explicit path extension (e.g. /page.md)     -> canonical path stripped, Vary: Accept = false
 * 3. HTTP Accept header (Accept: text/markdown) -> Vary: Accept = true
 * 4. Default fallback (usually 'html')          -> Vary: Accept = true (if Accept-negotiated URL)
 */
export function getRequestedFormat(
  urlOrPath: string,
  headers?: Headers | Record<string, string | string[] | undefined>,
  options?: NegotiationOptions
): NegotiatedFormatResult {
  const queryParamKey = (options?.queryParam ?? 'format').toLowerCase();
  const queryMap = options?.queryValueMap ?? DEFAULT_QUERY_VALUE_MAP;
  const enableSuffix = options?.enableExtensionSuffix ?? true;
  const defaultFormat = options?.defaultFormat ?? 'html';
  const minQuality = options?.minQualityThreshold ?? 0.001;

  // Parse URL safely to extract pathname and search parameters
  let pathname = urlOrPath;
  let searchParams: URLSearchParams | null = null;

  try {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      const parsedUrl = new URL(urlOrPath);
      pathname = parsedUrl.pathname;
      searchParams = parsedUrl.searchParams;
    } else {
      const [pathOnly = '/', queryPart = ''] = urlOrPath.split('?');
      pathname = pathOnly;
      if (queryPart) {
        searchParams = new URLSearchParams(queryPart);
      }
    }
  } catch {
    pathname = urlOrPath.split('?')[0] || '/';
  }

  // 1. Explicit Query Parameter check
  if (searchParams && searchParams.has(queryParamKey)) {
    const rawVal = (searchParams.get(queryParamKey) ?? '').trim().toLowerCase();
    const mapped = queryMap[rawVal];
    if (mapped) {
      return {
        format: mapped,
        source: 'query',
        canonicalPath: enableSuffix ? stripMarkdownExtension(pathname) : pathname,
        shouldVaryAccept: false,
      };
    }
  }

  // 2. Explicit Path Extension check (.md)
  if (enableSuffix && /\.md$/i.test(pathname)) {
    return {
      format: 'markdown',
      source: 'extension',
      canonicalPath: stripMarkdownExtension(pathname),
      shouldVaryAccept: false,
    };
  }

  // Canonical path for header or default negotiation
  const canonicalPath = pathname;

  // 3. HTTP Accept Header check
  const acceptHeader = getHeaderValue(headers, 'accept');
  if (acceptHeader) {
    const parsed = parseAcceptHeader(acceptHeader);

    // Find markdown and html entries
    const markdownEntry = parsed.find(
      (e) =>
        e.mediaType === 'text/markdown' ||
        e.mediaType === 'text/x-markdown'
    );

    const htmlEntry = parsed.find(
      (e) =>
        e.mediaType === 'text/html' ||
        e.mediaType === 'application/xhtml+xml'
    );

    // If text/markdown was explicitly specified
    if (markdownEntry && markdownEntry.quality >= minQuality) {
      // If HTML is also present, compare quality scores
      if (htmlEntry) {
        if (markdownEntry.quality >= htmlEntry.quality) {
          return {
            format: 'markdown',
            source: 'accept-header',
            canonicalPath,
            shouldVaryAccept: true,
            quality: markdownEntry.quality,
          };
        }
      } else {
        // Markdown requested without explicit HTML
        return {
          format: 'markdown',
          source: 'accept-header',
          canonicalPath,
          shouldVaryAccept: true,
          quality: markdownEntry.quality,
        };
      }
    }
  }

  // 4. Default Fallback
  // When format was not explicitly selected via query or extension, representation
  // is subject to content negotiation (RFC 9111 Section 4.1). Both HTML and Markdown
  // representations of a negotiated URL must emit Vary: Accept.
  return {
    format: defaultFormat,
    source: 'default',
    canonicalPath,
    shouldVaryAccept: true,
  };
}

/**
 * Convenience helper returning whether Markdown should be served for a request.
 */
export function shouldServeMarkdown(
  urlOrPath: string,
  headers?: Headers | Record<string, string | string[] | undefined>,
  options?: NegotiationOptions
): boolean {
  return getRequestedFormat(urlOrPath, headers, options).format === 'markdown';
}
