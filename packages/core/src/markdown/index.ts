import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { MarkdownConversionError } from '../errors/index.js';
import { extractHtmlMetadata, serializeWithFrontmatter } from '../metadata/index.js';
import type { HtmlToMarkdownOptions } from '../types/index.js';
import { gfmPlugin } from './gfm.js';

const DEFAULT_EXCLUDE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'nav',
  'footer',
  'header',
  '.nav',
  '.navigation',
  '.menu',
  '.sidebar',
  '.advertisement',
  '.ad',
  '#ad',
  '#cookie-notice',
  '.cookie-banner',
  '.modal',
  '[aria-hidden="true"]',
  'template',
];

const DEFAULT_MAX_INPUT_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_SAFE_DOM_DEPTH = 128;
const MAX_TABLE_ROWS = 500;

/**
 * Creates and configures a TurndownService instance with agent-optimized rules.
 */
function createTurndownService(options?: HtmlToMarkdownOptions): TurndownService {
  const service = new TurndownService({
    headingStyle: options?.headingStyle ?? 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: options?.codeBlockStyle ?? 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });

  // Apply GitHub Flavored Markdown (tables, strikethrough, task lists)
  if (options?.tables !== false) {
    service.use(gfmPlugin);
  }

  // Preserve code block language tags
  service.addRule('fencedCodeBlockWithLang', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild !== null &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement: (_content, node) => {
      const codeNode = node.firstChild as HTMLElement;
      const className = codeNode.getAttribute('class') || '';
      const langMatch = className.match(/language-(\S+)/) || className.match(/lang-(\S+)/);
      const language = langMatch ? langMatch[1] : '';
      const text = codeNode.textContent || '';
      return `\n\n\`\`\`${language}\n${text.replace(/\n$/, '')}\n\`\`\`\n\n`;
    },
  });

  // Remove empty links or useless anchors
  service.addRule('cleanLinks', {
    filter: (node) => node.nodeName === 'A' && !node.textContent?.trim(),
    replacement: () => '',
  });

  // Convert figures and captions cleanly
  service.addRule('figureWithCaption', {
    filter: 'figure',
    replacement: (_content, node) => {
      const img = (node as HTMLElement).querySelector('img');
      const caption = (node as HTMLElement).querySelector('figcaption');
      const alt = img?.getAttribute('alt') || caption?.textContent?.trim() || '';
      const src = img?.getAttribute('src') || '';
      if (!src) return '';
      const captionText = caption?.textContent?.trim();
      return `\n\n![${alt}](${src})${captionText ? `\n*${captionText}*` : ''}\n\n`;
    },
  });

  return service;
}

/**
 * Safely extracts text iteratively without call stack recursion on deeply nested nodes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeExtractText(node: any): string {
  const textPieces: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textStack: any[] = [node];
  while (textStack.length > 0) {
    const curr = textStack.pop();
    if (!curr) continue;
    if (curr.type === 'text') {
      textPieces.push(curr.data || '');
    } else if (curr.children && Array.isArray(curr.children)) {
      for (let i = curr.children.length - 1; i >= 0; i--) {
        textStack.push(curr.children[i]);
      }
    }
  }
  return textPieces.join('');
}

/**
 * Caps maximum DOM depth iteratively to prevent call stack overflow in Turndown
 * when converting deeply nested hostile HTML (Security S-08).
 */
function capDomDepth($: cheerio.CheerioAPI, maxDepth = MAX_SAFE_DOM_DEPTH): void {
  const root = $.root()[0];
  if (!root) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stack: Array<{ el: any; depth: number }> = [];
  for (const child of $(root).children().toArray()) {
    stack.push({ el: child, depth: 1 });
  }

  while (stack.length > 0) {
    const item = stack.pop()!;
    const el = item.el;
    if (item.depth > maxDepth) {
      const text = safeExtractText(el);
      $(el).empty();
      $(el).replaceWith(text);
      continue;
    }

    const children = $(el).children().toArray();
    for (const child of children) {
      stack.push({ el: child, depth: item.depth + 1 });
    }
  }
}

/**
 * Truncates oversized tables to prevent event-loop blocking (Security S-08).
 * Operates directly on table/tbody child node arrays for O(N) linear performance.
 */
function capTableRows($: cheerio.CheerioAPI, maxRows = MAX_TABLE_ROWS): void {
  $('table').each((_, tableEl) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const containers: any[] = [];
    const tbodies = $(tableEl).children('tbody');
    if (tbodies.length > 0) {
      tbodies.each((_, tb) => {
        containers.push(tb);
      });
    } else {
      containers.push(tableEl);
    }

    let totalRows = 0;
    let truncated = false;
    for (const container of containers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newChildren: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const child of (container.children || []) as any[]) {
        if (child.type === 'tag' && child.name === 'tr') {
          totalRows++;
          if (totalRows <= maxRows) {
            newChildren.push(child);
          } else {
            truncated = true;
          }
        } else {
          newChildren.push(child);
        }
      }
      if (newChildren.length > 0) {
        newChildren[newChildren.length - 1].next = null;
      }
      container.children = newChildren;
    }

    if (truncated) {
      $(tableEl).after(`\n\n*Note: Table truncated (showing first ${maxRows} rows).*\n\n`);
    }
  });
}

/**
 * Converts an HTML string into clean, structured, agent-friendly Markdown.
 */
export function htmlToMarkdown(
  html: string,
  options?: HtmlToMarkdownOptions
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const maxSize = options?.maxInputSizeBytes ?? DEFAULT_MAX_INPUT_SIZE;
  const inputByteLength = new TextEncoder().encode(html).length;
  if (inputByteLength > maxSize) {
    throw new MarkdownConversionError(
      `HTML input size exceeds maximum allowable limit of ${maxSize} bytes.`
    );
  }

  try {
    const $ = cheerio.load(html);

    // 1. Remove unwanted elements (scripts, styles, nav, cookies, banners)
    const excludeList = options?.excludeSelectors ?? DEFAULT_EXCLUDE_SELECTORS;
    for (const selector of excludeList) {
      $(selector).remove();
    }

    // 2. Sanitize dangerous URL schemes in links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (/^\s*(?:javascript|vbscript|data:text\/html)/i.test(href)) {
        $(el).attr('href', '#');
      }
    });

    // 3. Resolve relative URLs if baseUrl is provided
    if (options?.baseUrl) {
      const base = options.baseUrl;
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          try {
            const absoluteUrl = new URL(href, base).toString();
            $(el).attr('href', absoluteUrl);
          } catch {
            // Keep original href if invalid URL
          }
        }
      });

      $('img[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          try {
            const absoluteSrc = new URL(src, base).toString();
            $(el).attr('src', absoluteSrc);
          } catch {
            // Keep original src if invalid URL
          }
        }
      });
    }

    // 4. Resource exhaustion defense: Cap DOM depth & table rows (Security S-08)
    capDomDepth($);
    capTableRows($);

    // 5. Determine target HTML content without dropping multiple articles
    let targetHtml = '';
    if (options?.contentSelector && $(options.contentSelector).length > 0) {
      targetHtml = $(options.contentSelector)
        .map((_, el) => $(el).html() || '')
        .get()
        .join('\n\n');
    } else {
      const mainEl = $('main, [role="main"]');
      if (mainEl.length > 0) {
        targetHtml = mainEl.html() || '';
      } else if ($('article').length > 0) {
        // Collect all articles if no main element (e.g. blog feed)
        targetHtml = $('article')
          .map((_, el) => $(el).html() || '')
          .get()
          .join('\n\n---\n\n');
      } else if ($('body').length > 0) {
        targetHtml = $('body').html() || '';
      } else {
        targetHtml = $.html();
      }
    }

    if (!targetHtml.trim()) {
      return '';
    }

    // 6. Convert using Turndown
    const turndown = createTurndownService(options);
    let markdown = turndown.turndown(targetHtml);

    // 7. Post-processing: Normalize excessive whitespace, list item spacing & newlines
    markdown = markdown
      .replace(/\r\n/g, '\n')
      .replace(/^([ \t]*[-*+])\s{2,}/gm, '$1 ') // Convert '-   item' to '- item'
      .replace(/^([ \t]*\d+\.)\s{2,}/gm, '$1 ') // Convert '1.   item' to '1. item'
      .replace(/[ \t]+$/gm, '') // Remove trailing spaces on lines
      .replace(/\n{3,}/g, '\n\n') // Collapse 3+ newlines to 2
      .trim();

    // 8. Prepend frontmatter if requested
    if (options?.includeFrontmatter) {
      const meta = extractHtmlMetadata(html);
      const frontmatterData: Record<string, unknown> = {};

      if (meta.title) frontmatterData.title = meta.title;
      if (meta.description) frontmatterData.description = meta.description;
      if (meta.canonicalUrl) frontmatterData.canonical_url = meta.canonicalUrl;
      if (meta.language) frontmatterData.language = meta.language;

      markdown = serializeWithFrontmatter(markdown, frontmatterData);
    }

    return markdown;
  } catch (err: unknown) {
    if (err instanceof MarkdownConversionError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new MarkdownConversionError(`Failed to convert HTML to Markdown: ${message}`);
  }
}
