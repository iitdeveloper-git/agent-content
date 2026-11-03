/**
 * Core type definitions for AgentContent.
 */

export type ContentFormat = 'markdown' | 'html' | 'raw';

export type NegotiationSource = 'query' | 'extension' | 'accept-header' | 'default';

export interface NegotiatedFormatResult {
  /** Resolved format to serve */
  format: ContentFormat;
  /** How the format was determined */
  source: NegotiationSource;
  /** Clean canonical path (without format extensions like .md) */
  canonicalPath: string;
  /** Whether the response representation depends on the Accept header (true -> emit Vary: Accept) */
  shouldVaryAccept: boolean;
  /** Quality score from the Accept header if applicable */
  quality?: number;
}

export interface NegotiationOptions {
  /** Query parameter name for format override (default: 'format') */
  queryParam?: string;
  /** Supported query parameter values mapped to format (default: md -> markdown, markdown -> markdown, html -> html) */
  queryValueMap?: Record<string, ContentFormat>;
  /** Whether to support .md URL path suffix (default: true) */
  enableExtensionSuffix?: boolean;
  /** Default format if neither explicit format nor Accept header match (default: 'html') */
  defaultFormat?: ContentFormat;
  /** Minimum quality threshold for markdown Accept header (default: 0.001, q=0 is ignored) */
  minQualityThreshold?: number;
}

export interface StructuredPageSection {
  title: string;
  content: string;
  level?: number;
}

export interface StructuredPage {
  /** Unique URL path for the page (e.g. '/about' or 'https://example.com/about') */
  url: string;
  /** Page title */
  title: string;
  /** Meta description or short summary */
  description?: string;
  /** Main markdown content or section body */
  content: string;
  /** Optional structured sections */
  sections?: StructuredPageSection[];
  /** Canonical URL */
  canonicalUrl?: string;
  /** ISO 639-1 language code (e.g. 'en', 'es') */
  language?: string;
  /** Date published */
  publishedAt?: string | Date;
  /** Date last modified */
  updatedAt?: string | Date;
  /** Authors / contributors */
  authors?: string[];
  /** Categorization tags */
  tags?: string[];
  /** Optional section category (e.g. 'Documentation', 'Guides', 'API') */
  category?: string;
  /** Publication status (default: 'published') */
  status?: 'published' | 'draft' | 'archived';
  /** Additional custom metadata */
  metadata?: Record<string, unknown>;
  /** JSON-LD structured data object */
  structuredData?: Record<string, unknown>;
}

export interface SiteConfig {
  /** Human-readable site name */
  name: string;
  /** Base URL of the website */
  url: string;
  /** Short site description / tagline */
  description?: string;
  /** Default language code */
  language?: string;
  /** Default author / organization */
  author?: string;
}

export interface HtmlToMarkdownOptions {
  /** CSS selectors to remove from the DOM before conversion */
  excludeSelectors?: string[];
  /** CSS selector for the primary content container (e.g. 'main', 'article', '#content') */
  contentSelector?: string;
  /** Base URL to resolve relative links into absolute links */
  baseUrl?: string;
  /** Heading style: ATX ('# Heading') or Setext ('Heading\n===') */
  headingStyle?: 'atx' | 'setext';
  /** Code block style: 'fenced' (```) or 'indented' (4 spaces) */
  codeBlockStyle?: 'fenced' | 'indented';
  /** Whether to prepend YAML frontmatter extracted from HTML metadata */
  includeFrontmatter?: boolean;
  /** Maximum allowable HTML input size in bytes (default: 5MB) */
  maxInputSizeBytes?: number;
  /** Preserve table formatting using GitHub Flavored Markdown (default: true) */
  tables?: boolean;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  language?: string;
  publishedAt?: string;
  updatedAt?: string;
  authors?: string[];
  headings?: string[];
  jsonLd?: Record<string, unknown>[];
  og?: Record<string, string>;
  twitter?: Record<string, string>;
}

export interface LlmsTxtSection {
  title: string;
  description?: string;
  pages: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
}

export interface LlmsTxtOptions {
  site: SiteConfig;
  pages: StructuredPage[];
  /** Optional summary or guidance notes for LLM agents */
  notes?: string[];
  /** Additional optional links or resources */
  optionalLinks?: Array<{
    title: string;
    url: string;
    description?: string;
  }>;
  /** Group pages by category into sections (default: true) */
  groupByCategory?: boolean;
  /** Max pages to include (default: 1000) */
  maxPages?: number;
}

export interface LlmsFullTxtOptions extends LlmsTxtOptions {
  /** Maximum aggregated character length before truncation (default: 500,000) */
  maxCharacterLimit?: number;
  /** Include table of contents at the beginning (default: true) */
  includeToc?: boolean;
}

export interface CacheOptions {
  /** Cache-Control max-age in seconds (default: 3600) */
  maxAge?: number;
  /** Cache-Control stale-while-revalidate in seconds (default: 86400) */
  staleWhileRevalidate?: number;
  /** Whether cache is public or private (default: true) */
  public?: boolean;
  /** ETag prefix (default: 'md-') */
  etagPrefix?: string;
  /** Custom Cache-Control header override */
  customCacheControl?: string;
}

export interface SecurityOptions {
  /** Maximum request body size in bytes (default: 5MB) */
  maxRequestSizeBytes?: number;
  /** Maximum output size in bytes (default: 10MB) */
  maxOutputSizeBytes?: number;
  /** Whether SSRF protection is enabled for URL fetching (default: true) */
  ssrfProtection?: boolean;
  /** Explicit allowed external hostnames for remote fetching */
  allowedHosts?: string[];
  /** Timeout for remote HTTP requests in milliseconds (default: 5000) */
  requestTimeoutMs?: number;
  /** Allowlist of public paths (if set, any path not matching is treated as 404) */
  allowedPaths?: string[];
}

export interface AgentContentConfig {
  site: SiteConfig;
  pages?: StructuredPage[];
  negotiation?: Partial<NegotiationOptions>;
  markdown?: HtmlToMarkdownOptions;
  cache?: CacheOptions;
  security?: SecurityOptions;
}

