import * as cheerio from 'cheerio';
import * as yaml from 'yaml';
import type { PageMetadata } from '../types/index.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parses YAML frontmatter from a Markdown document.
 * Safely handles missing, invalid, or empty frontmatter.
 */
export function extractFrontmatter(markdown: string): {
  frontmatter: Record<string, unknown>;
  content: string;
} {
  if (!markdown || typeof markdown !== 'string') {
    return { frontmatter: {}, content: '' };
  }

  const match = FRONTMATTER_REGEX.exec(markdown);
  if (!match || !match[1]) {
    return { frontmatter: {}, content: markdown };
  }

  try {
    const rawYaml = match[1];
    const parsed = yaml.parse(rawYaml);
    const frontmatter = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    const content = markdown.slice(match[0].length);
    return { frontmatter, content };
  } catch {
    // If frontmatter YAML is malformed, return raw markdown with empty frontmatter
    return { frontmatter: {}, content: markdown };
  }
}

/**
 * Serializes a Markdown body with YAML frontmatter.
 */
export function serializeWithFrontmatter(
  content: string,
  frontmatter?: Record<string, unknown>
): string {
  const trimmedContent = content.trim();

  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return trimmedContent;
  }

  // Filter out undefined and function values
  const cleanFrontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && typeof value !== 'function') {
      cleanFrontmatter[key] = value;
    }
  }

  if (Object.keys(cleanFrontmatter).length === 0) {
    return trimmedContent;
  }

  const yamlString = yaml.stringify(cleanFrontmatter, {
    indent: 2,
    lineWidth: 0,
  }).trim();

  return `---\n${yamlString}\n---\n\n${trimmedContent}\n`;
}

/**
 * Safely extracts metadata, OpenGraph tags, JSON-LD, and headings from an HTML document.
 */
export function extractHtmlMetadata(html: string): PageMetadata {
  if (!html || typeof html !== 'string') {
    return {};
  }

  const $ = cheerio.load(html);
  const metadata: PageMetadata = {};

  // Title: <title> or <meta property="og:title">
  const title =
    $('title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim();
  if (title) metadata.title = title;

  // Description: <meta name="description"> or og:description
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="twitter:description"]').attr('content')?.trim();
  if (description) metadata.description = description;

  // Canonical URL: <link rel="canonical"> or og:url
  const canonicalUrl =
    $('link[rel="canonical"]').attr('href')?.trim() ||
    $('meta[property="og:url"]').attr('content')?.trim();
  if (canonicalUrl) metadata.canonicalUrl = canonicalUrl;

  // Language: <html lang="...">
  const language = $('html').attr('lang')?.trim();
  if (language) metadata.language = language;

  // OpenGraph tags
  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) {
      og[prop.replace(/^og:/, '')] = content.trim();
    }
  });
  if (Object.keys(og).length > 0) metadata.og = og;

  // Twitter tags
  const twitter: Record<string, string> = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) {
      twitter[name.replace(/^twitter:/, '')] = content.trim();
    }
  });
  if (Object.keys(twitter).length > 0) metadata.twitter = twitter;

  // Headings
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text) headings.push(text);
  });
  if (headings.length > 0) metadata.headings = headings;

  // JSON-LD structured data
  const jsonLdList: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'object' && item !== null) {
              jsonLdList.push(item as Record<string, unknown>);
            }
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          jsonLdList.push(parsed as Record<string, unknown>);
        }
      }
    } catch {
      // Ignore invalid JSON-LD without crashing
    }
  });
  if (jsonLdList.length > 0) metadata.jsonLd = jsonLdList;

  return metadata;
}

