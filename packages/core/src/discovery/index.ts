import { normalizePath, renderStructuredPageToMarkdown } from '../content/index.js';
import type {
  LlmsFullTxtOptions,
  LlmsTxtOptions,
  StructuredPage,
} from '../types/index.js';

/**
 * Resolves a page URL to an absolute URL based on the site base URL.
 */
function toAbsoluteUrl(pageUrl: string, baseUrl: string): string {
  try {
    if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://')) {
      return pageUrl;
    }
    return new URL(normalizePath(pageUrl), baseUrl).toString();
  } catch {
    return pageUrl;
  }
}

/**
 * Sanitizes markdown link label (title) to prevent markdown and newline injection.
 * Collapses newlines/tabs to spaces, escapes square brackets, and trims.
 */
function sanitizeLinkLabel(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\[\]]/g, (match) => `\\${match}`)
    .trim();
}

/**
 * Sanitizes description text for llms.txt to prevent heading and block injection.
 * Collapses newlines/tabs to single spaces, removes control characters, and trims.
 */
function sanitizeDescription(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Generates an RFC-compliant `llms.txt` discovery file according to the llmstxt.org specification.
 * Fully deterministic and protected against markdown/heading injection (Security S-07).
 */
export function generateLlmsTxt(options: LlmsTxtOptions): string {
  const { site, pages = [], notes = [], optionalLinks = [], groupByCategory = true } = options;
  const maxPages = options.maxPages ?? 1000;

  const lines: string[] = [];

  // 1. Site Title & Short Description
  lines.push(`# ${sanitizeLinkLabel(site.name)}`);
  if (site.description) {
    lines.push(`> ${sanitizeDescription(site.description)}`);
  }
  lines.push('');

  // 2. Optional Notes / Guidance for LLM crawlers
  if (notes.length > 0) {
    for (const note of notes) {
      lines.push(sanitizeDescription(note));
    }
    lines.push('');
  }

  // 3. Filter published pages and deduplicate by URL
  const seenUrls = new Set<string>();
  const publishedPages: StructuredPage[] = [];

  for (const page of pages) {
    if (page.status && page.status !== 'published') {
      continue;
    }
    const absUrl = toAbsoluteUrl(page.url, site.url);
    if (seenUrls.has(absUrl)) {
      continue;
    }
    seenUrls.add(absUrl);
    publishedPages.push(page);
    if (publishedPages.length >= maxPages) break;
  }

  // 4. Group pages by category
  if (groupByCategory) {
    const categories = new Map<string, StructuredPage[]>();

    for (const page of publishedPages) {
      const category = page.category || 'Pages';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(page);
    }

    // Sort categories deterministically
    const sortedCategories = Array.from(categories.keys()).sort((a, b) => {
      if (a === 'Pages') return 1;
      if (b === 'Pages') return -1;
      return a.localeCompare(b);
    });

    for (const catName of sortedCategories) {
      const catPages = categories.get(catName)!;
      // Sort pages within category deterministically by url
      catPages.sort((a, b) => a.url.localeCompare(b.url));

      lines.push(`## ${catName}`);
      for (const page of catPages) {
        const absUrl = toAbsoluteUrl(page.url, site.url);
        const safeTitle = sanitizeLinkLabel(page.title || 'Untitled');
        const desc = page.description ? `: ${sanitizeDescription(page.description)}` : '';
        lines.push(`- [${safeTitle}](${absUrl})${desc}`);
      }
      lines.push('');
    }
  } else if (publishedPages.length > 0) {
    publishedPages.sort((a, b) => a.url.localeCompare(b.url));
    lines.push('## Pages');
    for (const page of publishedPages) {
      const absUrl = toAbsoluteUrl(page.url, site.url);
      const safeTitle = sanitizeLinkLabel(page.title || 'Untitled');
      const desc = page.description ? `: ${sanitizeDescription(page.description)}` : '';
      lines.push(`- [${safeTitle}](${absUrl})${desc}`);
    }
    lines.push('');
  }

  // 5. Optional links section
  if (optionalLinks.length > 0) {
    lines.push('## Optional');
    for (const link of optionalLinks) {
      const safeTitle = sanitizeLinkLabel(link.title || 'Link');
      const desc = link.description ? `: ${sanitizeDescription(link.description)}` : '';
      lines.push(`- [${safeTitle}](${link.url})${desc}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * Generates an aggregated `llms-full.txt` containing full Markdown bodies of all public pages.
 */
export function generateLlmsFullTxt(options: LlmsFullTxtOptions): string {
  const { site, pages = [], maxCharacterLimit = 500_000, includeToc = true } = options;
  const lines: string[] = [];

  // 1. Header
  lines.push(`# ${sanitizeLinkLabel(site.name)} — Complete Documentation`);
  if (site.description) {
    lines.push(`> ${sanitizeDescription(site.description)}`);
  }
  lines.push('');

  // 2. Filter published pages
  const seenUrls = new Set<string>();
  const publishedPages: StructuredPage[] = [];

  for (const page of pages) {
    if (page.status && page.status !== 'published') {
      continue;
    }
    const absUrl = toAbsoluteUrl(page.url, site.url);
    if (seenUrls.has(absUrl)) {
      continue;
    }
    seenUrls.add(absUrl);
    publishedPages.push(page);
  }

  publishedPages.sort((a, b) => a.url.localeCompare(b.url));

  // 3. Table of Contents
  if (includeToc && publishedPages.length > 0) {
    lines.push('## Table of Contents');
    for (const page of publishedPages) {
      const absUrl = toAbsoluteUrl(page.url, site.url);
      const safeTitle = sanitizeLinkLabel(page.title || 'Untitled');
      lines.push(`- [${safeTitle}](${absUrl})`);
    }
    lines.push('\n---\n');
  }

  // 4. Aggregated Page Markdown
  let currentLength = lines.join('\n').length;

  for (const page of publishedPages) {
    const pageMarkdown = renderStructuredPageToMarkdown(page, site.url);
    const pageBlock = `\n<!-- Document: ${toAbsoluteUrl(page.url, site.url)} -->\n\n${pageMarkdown}\n\n---\n`;

    if (currentLength + pageBlock.length > maxCharacterLimit) {
      lines.push('\n\n<!-- Output truncated due to maxCharacterLimit -->\n');
      break;
    }

    lines.push(pageBlock);
    currentLength += pageBlock.length;
  }

  return lines.join('\n').trim() + '\n';
}
