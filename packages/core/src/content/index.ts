import { z } from 'zod';
import { ContentValidationError, RegistryError } from '../errors/index.js';
import { serializeWithFrontmatter } from '../metadata/index.js';
import { stripMarkdownExtension } from '../negotiation/index.js';
import type {
  AgentContentConfig,
  StructuredPage,
  StructuredRenderOptions,
} from '../types/index.js';

/** Maximum nesting depth accepted for opt-in metadata / structured data. */
const MAX_SERIALIZABLE_DEPTH = 16;
/** Maximum serialized size (bytes of JSON) accepted for each opt-in field. */
const MAX_SERIALIZABLE_BYTES = 64 * 1024;

/**
 * Copies a value into a plain, JSON-safe structure, or returns `undefined` if it cannot be
 * represented safely. Accepts plain objects, arrays, strings, finite numbers, booleans, null and
 * Dates (as ISO strings). Rejects functions, symbols, bigints, class instances, cycles,
 * non-finite numbers, excessive depth, and `undefined` array items.
 */
function toJsonSafe(value: unknown, depth: number, seen: Set<object>): { ok: true; value: unknown } | { ok: false } {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { ok: false } : { ok: true, value: value.toISOString() };
  }
  if (typeof value !== 'object' || depth > MAX_SERIALIZABLE_DEPTH || seen.has(value)) {
    return { ok: false };
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (const item of value) {
        const r = toJsonSafe(item, depth + 1, seen);
        if (!r.ok) return { ok: false };
        out.push(r.value);
      }
      return { ok: true, value: out };
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return { ok: false };

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      const r = toJsonSafe(item, depth + 1, seen);
      if (!r.ok) return { ok: false };
      // defineProperty keeps a literal "__proto__" key as plain data instead of invoking the setter
      Object.defineProperty(out, key, { value: r.value, enumerable: true, writable: true, configurable: true });
    }
    return { ok: true, value: out };
  } finally {
    seen.delete(value);
  }
}

function sanitizeSerializable(value: unknown): Record<string, unknown> | undefined {
  const result = toJsonSafe(value, 0, new Set());
  if (!result.ok || typeof result.value !== 'object' || result.value === null || Array.isArray(result.value)) {
    return undefined;
  }
  if (Object.keys(result.value).length === 0) return undefined;
  if (JSON.stringify(result.value).length > MAX_SERIALIZABLE_BYTES) return undefined;
  return result.value as Record<string, unknown>;
}

/**
 * Validates `structuredData` as a JSON-LD node and serializes it as a fenced `jsonld` block.
 * Returns `undefined` (the field is omitted) if the value is not a valid, JSON-safe JSON-LD object.
 *
 * - Requires an `@type` or an `@graph`; anything else is not a meaningful JSON-LD node.
 * - Adds `"@context": "https://schema.org"` first when no `@context` is given.
 * - Escapes `` ` ``, `<`, `>` and `&` as \uXXXX so the data can neither close the Markdown fence nor
 *   form HTML if the block is later extracted and inlined; the JSON value is unchanged.
 */
function renderJsonLdBlock(structuredData: unknown): string | undefined {
  const safe = sanitizeSerializable(structuredData);
  if (!safe) return undefined;

  const hasType = typeof safe['@type'] === 'string' || Array.isArray(safe['@type']);
  const hasGraph = Array.isArray(safe['@graph']);
  if (!hasType && !hasGraph) return undefined;
  if ('@context' in safe) {
    const ctx = safe['@context'];
    if (typeof ctx !== 'string' && (typeof ctx !== 'object' || ctx === null)) return undefined;
  }

  const document: Record<string, unknown> = { '@context': 'https://schema.org' };
  for (const [key, value] of Object.entries(safe)) {
    Object.defineProperty(document, key, { value, enumerable: true, writable: true, configurable: true });
  }

  const json = JSON.stringify(document, null, 2)
    .replace(/`/g, '\\u0060')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return '```jsonld\n' + json + '\n```';
}

/**
 * Zod validation schema for site configuration.
 */
export const siteConfigSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  url: z.string().url('Site URL must be a valid URL'),
  description: z.string().optional(),
  language: z.string().optional(),
  author: z.string().optional(),
});

/**
 * Zod validation schema for structured page sections.
 */
export const structuredPageSectionSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  level: z.number().int().min(1).max(6).optional(),
});

/**
 * Zod validation schema for structured pages.
 */
export const structuredPageSchema = z.object({
  url: z.string().min(1, 'Page URL is required'),
  title: z.string().min(1, 'Page title is required'),
  description: z.string().optional(),
  content: z.string().default(''),
  sections: z.array(structuredPageSectionSchema).optional(),
  canonicalUrl: z.string().optional(),
  language: z.string().optional(),
  publishedAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  authors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  status: z.enum(['published', 'draft', 'archived']).default('published'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  structuredData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Normalizes a URL path to ensure consistent lookup (leading slash, no trailing slash, no .md).
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  let cleaned = rawPath.trim();

  // Strip origin if full URL passed
  try {
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      const u = new URL(cleaned);
      cleaned = u.pathname;
    }
  } catch {
    // Keep as is
  }

  // Strip query and hash
  cleaned = cleaned.split('?')[0]?.split('#')[0] || '/';

  // Strip .md extension
  cleaned = stripMarkdownExtension(cleaned);

  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = `/${cleaned}`;
  }

  // Strip trailing slash unless root '/'
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Renders a StructuredPage into clean Markdown with frontmatter.
 */
export function renderStructuredPageToMarkdown(
  page: StructuredPage,
  siteUrl?: string,
  options?: StructuredRenderOptions
): string {
  const frontmatter: Record<string, unknown> = {
    title: page.title,
  };

  if (page.description) frontmatter.description = page.description;
  if (page.canonicalUrl) {
    frontmatter.canonical_url = page.canonicalUrl;
  } else if (siteUrl) {
    try {
      frontmatter.canonical_url = new URL(page.url, siteUrl).toString();
    } catch {
      frontmatter.canonical_url = page.url;
    }
  } else {
    frontmatter.canonical_url = page.url;
  }

  if (page.language) frontmatter.language = page.language;
  if (page.updatedAt) {
    frontmatter.updated_at =
      page.updatedAt instanceof Date ? page.updatedAt.toISOString() : page.updatedAt;
  }
  if (page.publishedAt) {
    frontmatter.published_at =
      page.publishedAt instanceof Date ? page.publishedAt.toISOString() : page.publishedAt;
  }
  if (page.authors && page.authors.length > 0) frontmatter.authors = page.authors;
  if (page.tags && page.tags.length > 0) frontmatter.tags = page.tags;
  if (page.category) frontmatter.category = page.category;

  // Opt-in: custom metadata is nested under one key so it can never collide with (or duplicate)
  // the reserved keys above. Unrepresentable values drop the whole field instead of failing.
  if (options?.includeMetadata) {
    const metadata = sanitizeSerializable(page.metadata);
    if (metadata) frontmatter.metadata = metadata;
  }

  // Build markdown body
  const parts: string[] = [];

  // Main content
  if (page.content && page.content.trim()) {
    parts.push(page.content.trim());
  }

  // Append structured sections if present
  if (page.sections && page.sections.length > 0) {
    for (const section of page.sections) {
      const level = section.level ?? 2;
      const headingPrefix = '#'.repeat(level);
      parts.push(`${headingPrefix} ${section.title}\n\n${section.content.trim()}`);
    }
  }

  // Opt-in: JSON-LD is appended once, as inert fenced text (never raw HTML).
  if (options?.includeStructuredData) {
    const jsonLd = renderJsonLdBlock(page.structuredData);
    if (jsonLd) parts.push(jsonLd);
  }

  const rawBody = parts.join('\n\n');
  return serializeWithFrontmatter(rawBody, frontmatter);
}

/**
 * In-memory registry for structured pages.
 */
export class ContentRegistry {
  private pages = new Map<string, StructuredPage>();

  constructor(initialPages: StructuredPage[] = []) {
    for (const page of initialPages) {
      this.register(page);
    }
  }

  /**
   * Registers a structured page in the registry.
   */
  public register(page: StructuredPage): void {
    const parsed = structuredPageSchema.safeParse(page);
    if (!parsed.success) {
      throw new ContentValidationError(
        `Invalid page registration for URL "${page.url}": ${parsed.error.message}`,
        parsed.error.issues
      );
    }

    const normalized = normalizePath(parsed.data.url);
    this.pages.set(normalized, {
      ...parsed.data,
      url: normalized,
    });
  }

  /**
   * Retrieves a page by its path or URL.
   */
  public get(pathOrUrl: string): StructuredPage | undefined {
    const key = normalizePath(pathOrUrl);
    return this.pages.get(key);
  }

  /**
   * Checks if a page exists in the registry.
   */
  public has(pathOrUrl: string): boolean {
    const key = normalizePath(pathOrUrl);
    return this.pages.has(key);
  }

  /**
   * Lists pages, optionally filtering by status and tags.
   */
  public list(options?: {
    status?: 'published' | 'draft' | 'archived';
    tag?: string;
    category?: string;
  }): StructuredPage[] {
    const result: StructuredPage[] = [];

    for (const page of this.pages.values()) {
      if (options?.status && page.status !== options.status) {
        continue;
      }
      if (options?.tag && (!page.tags || !page.tags.includes(options.tag))) {
        continue;
      }
      if (options?.category && page.category !== options.category) {
        continue;
      }
      result.push(page);
    }

    return result;
  }

  /**
   * Number of registered pages.
   */
  public size(): number {
    return this.pages.size;
  }

  /**
   * Clears all pages from the registry.
   */
  public clear(): void {
    this.pages.clear();
  }
}

/**
 * Primary AgentContent instance returned by defineAgentContent.
 */
export interface AgentContentInstance {
  readonly config: AgentContentConfig;
  readonly registry: ContentRegistry;
  getPage(pathOrUrl: string): StructuredPage | undefined;
  getMarkdown(pathOrUrl: string): string | undefined;
  listPages(filter?: { status?: 'published' | 'draft' | 'archived'; tag?: string; category?: string }): StructuredPage[];
  registerPage(page: StructuredPage): void;
}

/**
 * Defines AgentContent configuration and initializes the content registry.
 */
export function defineAgentContent(config: AgentContentConfig): AgentContentInstance {
  const siteValidation = siteConfigSchema.safeParse(config.site);
  if (!siteValidation.success) {
    throw new ContentValidationError(
      `Invalid site configuration: ${siteValidation.error.message}`,
      siteValidation.error.issues
    );
  }

  const registry = new ContentRegistry(config.pages ?? []);

  return {
    config,
    registry,
    getPage(pathOrUrl: string) {
      return registry.get(pathOrUrl);
    },
    getMarkdown(pathOrUrl: string) {
      const page = registry.get(pathOrUrl);
      if (!page) return undefined;
      // Never serve unpublished pages through public getMarkdown
      if (page.status && page.status !== 'published') {
        throw new RegistryError(`Page at "${pathOrUrl}" is not published.`, 404);
      }
      return renderStructuredPageToMarkdown(page, config.site.url, config.render);
    },
    listPages(filter) {
      return registry.list(filter);
    },
    registerPage(page: StructuredPage) {
      registry.register(page);
    },
  };
}
