import { z } from 'zod';
import { ContentValidationError, RegistryError } from '../errors/index.js';
import { serializeWithFrontmatter } from '../metadata/index.js';
import { stripMarkdownExtension } from '../negotiation/index.js';
import type {
  AgentContentConfig,
  StructuredPage,
} from '../types/index.js';

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
  metadata: z.record(z.unknown()).optional(),
  structuredData: z.record(z.unknown()).optional(),
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
  siteUrl?: string
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
      return renderStructuredPageToMarkdown(page, config.site.url);
    },
    listPages(filter) {
      return registry.list(filter);
    },
    registerPage(page: StructuredPage) {
      registry.register(page);
    },
  };
}
