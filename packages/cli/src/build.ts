import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import picocolors from 'picocolors';
import {
  extractHtmlMetadata,
  generateLlmsFullTxt,
  generateLlmsTxt,
  htmlToMarkdown,
  type StructuredPage,
} from '@iitdeveloper/agent-content';

export interface StaticBuildOptions {
  /** Directory containing static HTML files */
  dir: string;
  /** Directory to output Markdown and llms.txt files */
  outDir?: string;
  /** Base URL of the website */
  baseUrl?: string;
  /** Site name */
  siteName?: string;
  /** Site description */
  siteDescription?: string;
  /** Comma-separated or array of path patterns to exclude */
  exclude?: string[];
  /** Generate web server config snippets (default: false) */
  generateRules?: boolean;
  /** Force overwrite of existing hosting rule files (default: false) */
  force?: boolean;
}

export interface BuildReport {
  pagesDiscovered: number;
  pagesConverted: number;
  totalPagesSkipped: number;
  totalHtmlBytes: number;
  totalMarkdownBytes: number;
  tokenSavingsPercent: number;
  llmsTxtPath: string;
  llmsFullTxtPath: string;
  durationMs: number;
}

const DEFAULT_EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.github',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.kilocode',
  '.vscode',
  '.idea',
  'admin',
  'private',
]);

const DEFAULT_EXCLUDE_FILENAMES = new Set([
  '404.html',
  '404.htm',
  '500.html',
  '500.htm',
  '502.html',
  '503.html',
]);

/**
 * Checks if a path matches an exclusion pattern or default exclusion rules.
 */
function isExcluded(relPath: string, name: string, isDir: boolean, userExcludes: string[]): boolean {
  // Exclude hidden or private directories / files starting with . or _
  if (name.startsWith('.') || name.startsWith('_')) {
    return true;
  }

  if (isDir && DEFAULT_EXCLUDE_DIR_NAMES.has(name.toLowerCase())) {
    return true;
  }

  if (!isDir && DEFAULT_EXCLUDE_FILENAMES.has(name.toLowerCase())) {
    return true;
  }

  const normalizedRel = relPath.replace(/\\/g, '/').toLowerCase();

  for (const pattern of userExcludes) {
    const cleanPattern = pattern.trim().toLowerCase();
    if (!cleanPattern) continue;
    if (normalizedRel === cleanPattern || normalizedRel.startsWith(cleanPattern + '/') || normalizedRel.includes('/' + cleanPattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Recursively scans a directory for HTML files, respecting exclusions.
 */
function findHtmlFiles(dir: string, baseDir: string, userExcludes: string[]): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });

  // Sort deterministically
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (isExcluded(relPath, entry.name, true, userExcludes)) {
        continue;
      }
      results.push(...findHtmlFiles(fullPath, baseDir, userExcludes));
    } else if (entry.isFile()) {
      if (isExcluded(relPath, entry.name, false, userExcludes)) {
        continue;
      }
      const ext = extname(entry.name).toLowerCase();
      if (ext === '.html' || ext === '.htm') {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Detects if an HTML document carries a noindex robots meta tag.
 */
function hasNoIndexMeta(html: string): boolean {
  const metaRobotsRegex = /<meta\s+[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i;
  const metaRobotsRegexAlt = /<meta\s+[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["'](?:robots|googlebot)["'][^>]*>/i;
  return metaRobotsRegex.test(html) || metaRobotsRegexAlt.test(html);
}

/**
 * Builds static Markdown representations and llms.txt for a static website directory.
 */
export async function buildStaticWebsite(options: StaticBuildOptions): Promise<BuildReport> {
  const startTime = Date.now();
  const sourceDir = resolve(process.cwd(), options.dir);
  const outDir = options.outDir ? resolve(process.cwd(), options.outDir) : sourceDir;
  const userExcludes = options.exclude ?? [];

  const htmlFiles = findHtmlFiles(sourceDir, sourceDir, userExcludes);
  const pages: StructuredPage[] = [];

  let totalHtmlBytes = 0;
  let totalMarkdownBytes = 0;
  let pagesConverted = 0;
  let totalPagesSkipped = 0;

  let inferredSiteName = options.siteName;
  let inferredSiteDescription = options.siteDescription;
  const baseUrl = options.baseUrl || 'https://example.com';

  for (const filePath of htmlFiles) {
    try {
      const relPath = relative(sourceDir, filePath);
      const htmlContent = readFileSync(filePath, 'utf8');

      // Skip pages with <meta name="robots" content="noindex">
      if (hasNoIndexMeta(htmlContent)) {
        totalPagesSkipped++;
        continue;
      }

      const htmlSize = Buffer.byteLength(htmlContent, 'utf8');
      totalHtmlBytes += htmlSize;

      // Extract metadata
      const meta = extractHtmlMetadata(htmlContent);

      // Compute route path: e.g. "about/index.html" -> "/about", "pricing.html" -> "/pricing"
      let routePath = '/' + relPath.replace(/\\/g, '/');
      if (routePath.endsWith('/index.html')) {
        routePath = routePath.slice(0, -'/index.html'.length) || '/';
      } else if (routePath.endsWith('.html')) {
        routePath = routePath.slice(0, -'.html'.length);
      }

      if (!inferredSiteName && routePath === '/' && meta.title) {
        inferredSiteName = meta.title;
      }
      if (!inferredSiteDescription && routePath === '/' && meta.description) {
        inferredSiteDescription = meta.description;
      }

      const title = meta.title || routePath;
      const description = meta.description;

      // Convert HTML to clean Markdown with frontmatter
      const markdown = htmlToMarkdown(htmlContent, {
        baseUrl,
        includeFrontmatter: true,
      });

      const mdSize = Buffer.byteLength(markdown, 'utf8');
      totalMarkdownBytes += mdSize;
      pagesConverted++;

      // Write .md file to output directory
      const targetMdPath = join(outDir, relPath.replace(/\.html?$/i, '.md'));
      mkdirSync(dirname(targetMdPath), { recursive: true });
      writeFileSync(targetMdPath, markdown, 'utf8');

      // If file was index.html in a subdirectory, also write parent .md (e.g. docs.md alongside docs/index.md)
      if (relPath.endsWith('index.html') && relPath !== 'index.html') {
        const parentMdPath = join(outDir, relPath.replace(/\/index\.html?$/i, '.md'));
        try {
          writeFileSync(parentMdPath, markdown, 'utf8');
        } catch {
          // Ignore if directory name conflict
        }
      }

      pages.push({
        url: routePath,
        title,
        description,
        content: markdown,
        status: 'published',
        category: routePath.split('/')[1] ? routePath.split('/')[1]?.toUpperCase() : 'General',
      });
    } catch (err: unknown) {
      // Per-file error isolation: one malformed page doesn't abort the build
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(picocolors.yellow(`Warning: Skipped file ${filePath} due to error: ${msg}`));
      totalPagesSkipped++;
    }
  }

  // Fallback site info
  const siteConfig = {
    name: inferredSiteName || 'Static Website',
    url: baseUrl,
    description: inferredSiteDescription || 'Static website with AI-agent readability.',
  };

  // Generate llms.txt and llms-full.txt
  const llmsTxt = generateLlmsTxt({
    site: siteConfig,
    pages,
  });

  const llmsFullTxt = generateLlmsFullTxt({
    site: siteConfig,
    pages,
  });

  mkdirSync(outDir, { recursive: true });
  const llmsTxtPath = join(outDir, 'llms.txt');
  const llmsFullTxtPath = join(outDir, 'llms-full.txt');

  writeFileSync(llmsTxtPath, llmsTxt, 'utf8');
  writeFileSync(llmsFullTxtPath, llmsFullTxt, 'utf8');

  // Generate server rules ONLY if explicitly requested
  if (options.generateRules === true) {
    generateHostingRules(outDir, options.force === true);
  }

  const durationMs = Date.now() - startTime;
  const tokenSavingsPercent =
    totalHtmlBytes > 0
      ? Math.round(((totalHtmlBytes - totalMarkdownBytes) / totalHtmlBytes) * 100)
      : 0;

  return {
    pagesDiscovered: htmlFiles.length,
    pagesConverted,
    totalPagesSkipped,
    totalHtmlBytes,
    totalMarkdownBytes,
    tokenSavingsPercent,
    llmsTxtPath,
    llmsFullTxtPath,
    durationMs,
  };
}

/**
 * Safely writes a rule file, refusing to overwrite an existing file unless force is true.
 */
function safeWriteRuleFile(filePath: string, content: string, force: boolean): void {
  if (existsSync(filePath) && !force) {
    console.warn(picocolors.yellow(`! Skipped existing ${filePath} to prevent destructive overwrite (use --force to overwrite)`));
    return;
  }
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Emits deployment config snippets for Apache, Nginx, and Netlify.
 */
function generateHostingRules(outDir: string, force: boolean): void {
  // 1. Netlify _headers
  const netlifyHeaders = `/*
  X-Content-Type-Options: nosniff

/*.md
  Content-Type: text/markdown; charset=utf-8
  X-Content-Type-Options: nosniff

/llms.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
  Cache-Control: public, max-age=3600
`;
  safeWriteRuleFile(join(outDir, '_headers'), netlifyHeaders, force);

  // 2. Apache .htaccess
  const htaccess = `# AgentContent Apache Configuration
<IfModule mod_rewrite.c>
  RewriteEngine On

  # Content Negotiation: If client sends Accept: text/markdown
  RewriteCond %{HTTP_ACCEPT} text/markdown [NC]
  RewriteCond %{REQUEST_FILENAME}\\.md -f
  RewriteRule ^(.*)$ $1.md [L]

  # If client sends ?format=md
  RewriteCond %{QUERY_STRING} (?:^|&)format=md(?:&|$) [NC]
  RewriteCond %{REQUEST_FILENAME}\\.md -f
  RewriteRule ^(.*)$ $1.md [L]
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.md$">
    Header set Content-Type "text/markdown; charset=utf-8"
    Header set X-Content-Type-Options "nosniff"
    Header append Vary "Accept"
  </FilesMatch>
</IfModule>
`;
  safeWriteRuleFile(join(outDir, '.htaccess'), htaccess, force);

  // 3. Nginx snippet
  const nginx = `# AgentContent Nginx Configuration Snippet
location ~* \\.md$ {
    default_type text/markdown;
    charset utf-8;
    add_header X-Content-Type-Options nosniff always;
    add_header Vary Accept always;
    add_header Cache-Control "public, max-age=3600";
}

location = /llms.txt {
    default_type text/plain;
    charset utf-8;
    add_header X-Content-Type-Options nosniff always;
}

location = /llms-full.txt {
    default_type text/plain;
    charset utf-8;
    add_header X-Content-Type-Options nosniff always;
}
`;
  safeWriteRuleFile(join(outDir, 'nginx-agent-content.conf'), nginx, force);
}

/**
 * Prints a formatted CLI summary report.
 */
export function printBuildReport(report: BuildReport): void {
  console.log('\n' + picocolors.bold(picocolors.green('AgentContent Build Summary')));
  console.log('═'.repeat(50));
  console.log(`  HTML Pages Discovered : ${picocolors.cyan(String(report.pagesDiscovered))}`);
  console.log(`  Markdown Pages Built  : ${picocolors.green(String(report.pagesConverted))}`);
  if (report.totalPagesSkipped > 0) {
    console.log(`  Pages Skipped (noindex/error): ${picocolors.yellow(String(report.totalPagesSkipped))}`);
  }
  console.log(`  HTML Input Size       : ${(report.totalHtmlBytes / 1024).toFixed(1)} KB`);
  console.log(`  Markdown Output Size  : ${(report.totalMarkdownBytes / 1024).toFixed(1)} KB`);
  console.log(`  Payload Reduction     : ${picocolors.bold(picocolors.yellow(report.tokenSavingsPercent + '% less bytes'))}`);
  console.log(`  Build Duration        : ${report.durationMs}ms`);
  console.log('─'.repeat(50));
  console.log(`  ✓ llms.txt generated     : ${picocolors.dim(report.llmsTxtPath)}`);
  console.log(`  ✓ llms-full.txt generated: ${picocolors.dim(report.llmsFullTxtPath)}`);
  console.log('═'.repeat(50) + '\n');
}
