import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildStaticWebsite, createCli } from '../src/index.js';

describe('CLI & Static Website Inspector', () => {
  let tempSiteDir: string;

  beforeEach(() => {
    tempSiteDir = join(tmpdir(), `agent-content-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempSiteDir, { recursive: true });

    // Scaffold mock static website HTML files
    writeFileSync(
      join(tempSiteDir, 'index.html'),
      `<!DOCTYPE html>
      <html>
        <head>
          <title>My Static Site</title>
          <meta name="description" content="A great static website" />
        </head>
        <body>
          <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
          <main>
            <h1>Welcome Home</h1>
            <p>Welcome to our static website.</p>
          </main>
          <footer>Footer text</footer>
        </body>
      </html>`,
      'utf8'
    );

    const docsDir = join(tempSiteDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, 'getting-started.html'),
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Getting Started Guide</title>
        </head>
        <body>
          <main>
            <h1>Getting Started Guide</h1>
            <p>Steps to deploy.</p>
          </main>
        </body>
      </html>`,
      'utf8'
    );

    // Private directory (should be excluded)
    const privateDir = join(tempSiteDir, '_private');
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(join(privateDir, 'secret.html'), '<html><body>Secret</body></html>', 'utf8');

    // Admin directory (should be excluded)
    const adminDir = join(tempSiteDir, 'admin');
    mkdirSync(adminDir, { recursive: true });
    writeFileSync(join(adminDir, 'dashboard.html'), '<html><body>Admin</body></html>', 'utf8');

    // 404 page (should be excluded from index and markdown)
    writeFileSync(join(tempSiteDir, '404.html'), '<html><body>Page Not Found</body></html>', 'utf8');

    // Noindex page (should be excluded)
    writeFileSync(
      join(tempSiteDir, 'noindex.html'),
      '<html><head><meta name="robots" content="noindex" /></head><body>No index</body></html>',
      'utf8'
    );

    // Existing .htaccess file to test non-destructive write
    writeFileSync(join(tempSiteDir, '.htaccess'), '# Existing Custom Rules\nRewriteEngine On\n', 'utf8');
  });

  afterEach(() => {
    try {
      rmSync(tempSiteDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('creates commander instance with correct commands including build', () => {
    const cli = createCli();
    expect(cli.name()).toBe('agent-content');

    const commands = cli.commands.map((c) => c.name());
    expect(commands).toContain('init');
    expect(commands).toContain('build');
    expect(commands).toContain('validate');
    expect(commands).toContain('generate-llms');
  });

  it('builds markdown and skips private, admin, 404, and noindex pages', async () => {
    const outDir = join(tempSiteDir, 'out');
    const report = await buildStaticWebsite({
      dir: tempSiteDir,
      outDir,
      baseUrl: 'https://mysite.example.com',
      generateRules: false, // Default is false
    });

    expect(report.pagesDiscovered).toBe(3);
    expect(report.pagesConverted).toBe(2);
    expect(report.totalPagesSkipped).toBe(1);

    // Should NOT have created rules by default
    expect(existsSync(join(outDir, '.htaccess'))).toBe(false);
    expect(existsSync(join(outDir, '_headers'))).toBe(false);

    // Verify generated .md files
    const indexMdPath = join(outDir, 'index.md');
    expect(existsSync(indexMdPath)).toBe(true);

    const guideMdPath = join(outDir, 'docs', 'getting-started.md');
    expect(existsSync(guideMdPath)).toBe(true);

    // Private, admin, 404, noindex must NOT exist in output
    expect(existsSync(join(outDir, '_private', 'secret.md'))).toBe(false);
    expect(existsSync(join(outDir, 'admin', 'dashboard.md'))).toBe(false);
    expect(existsSync(join(outDir, '404.md'))).toBe(false);
    expect(existsSync(join(outDir, 'noindex.md'))).toBe(false);

    // Check llms.txt does not contain private pages
    const llmsTxt = readFileSync(report.llmsTxtPath, 'utf8');
    expect(llmsTxt).not.toContain('secret');
    expect(llmsTxt).not.toContain('admin');
    expect(llmsTxt).not.toContain('404');
    expect(llmsTxt).not.toContain('noindex');
  });

  it('does NOT destructively overwrite existing .htaccess when generateRules is true without force', async () => {
    const originalHtaccess = readFileSync(join(tempSiteDir, '.htaccess'), 'utf8');

    // Build directly in tempSiteDir where .htaccess exists
    await buildStaticWebsite({
      dir: tempSiteDir,
      outDir: tempSiteDir,
      baseUrl: 'https://mysite.example.com',
      generateRules: true,
      force: false, // non-destructive!
    });

    const currentHtaccess = readFileSync(join(tempSiteDir, '.htaccess'), 'utf8');
    expect(currentHtaccess).toBe(originalHtaccess);
  });

  it('generates llms.txt and creates output directory when it does not exist', () => {
    const cli = createCli();
    const configPath = join(tempSiteDir, 'agent-content.config.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        site: { name: 'Test Site', url: 'https://example.com' },
        pages: [{ url: '/', title: 'Home', content: '# Home Page' }],
      }),
      'utf8'
    );

    const nonExistentOutDir = join(tempSiteDir, 'nested', 'public');
    expect(existsSync(nonExistentOutDir)).toBe(false);

    // Run generate-llms with non-existent out-dir
    cli.parse(['node', 'agent-content', 'generate-llms', '-c', configPath, '-o', nonExistentOutDir]);

    expect(existsSync(nonExistentOutDir)).toBe(true);
    expect(existsSync(join(nonExistentOutDir, 'llms.txt'))).toBe(true);
    expect(existsSync(join(nonExistentOutDir, 'llms-full.txt'))).toBe(true);
    const content = readFileSync(join(nonExistentOutDir, 'llms.txt'), 'utf8');
    expect(content).toContain('# Test Site');
  });
});
