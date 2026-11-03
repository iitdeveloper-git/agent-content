import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/markdown/index.js';

describe('HTML to Markdown Conversion', () => {
  it('converts basic typography, headings, and paragraphs', () => {
    const html = `
      <h1>Main Heading</h1>
      <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
      <h2>Subheading</h2>
      <p>Another paragraph.</p>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Main Heading');
    expect(md).toContain('**bold** and *italic*');
    expect(md).toContain('## Subheading');
  });

  it('removes scripts, styles, navigation, footer, and cookie banners by default', () => {
    const html = `
      <html>
        <head>
          <style>body { color: red; }</style>
          <script>console.log('secret');</script>
        </head>
        <body>
          <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
          <div class="cookie-banner">Please accept our cookies!</div>
          <main>
            <h1>Article Title</h1>
            <p>Clean article body content that agents want.</p>
          </main>
          <footer>Copyright 2026 Example Corp</footer>
        </body>
      </html>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Article Title');
    expect(md).toContain('Clean article body content that agents want.');
    expect(md).not.toContain('console.log');
    expect(md).not.toContain('color: red');
    expect(md).not.toContain('Please accept our cookies');
    expect(md).not.toContain('Copyright 2026');
  });

  it('converts ordered and unordered lists', () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
      <ol>
        <li>First</li>
        <li>Second</li>
      </ol>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
    expect(md).toContain('1. First');
    expect(md).toContain('2. Second');
  });

  it('converts links and images with alt text', () => {
    const html = `
      <p>Visit <a href="https://example.com">our site</a>.</p>
      <img src="https://example.com/logo.png" alt="Company Logo" />
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('[our site](https://example.com)');
    expect(md).toContain('![Company Logo](https://example.com/logo.png)');
  });

  it('neutralizes dangerous URL schemes (S-11)', () => {
    const html = `
      <p><a href="javascript:alert(1)">Click Me</a></p>
      <p><a href="vbscript:msgbox(1)">Click VB</a></p>
      <p><a href="data:text/html,<script>alert(1)</script>">Click Data</a></p>
    `;
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('javascript:alert');
    expect(md).not.toContain('vbscript:');
    expect(md).not.toContain('data:text/html');
  });

  it('resolves relative URLs when baseUrl is provided', () => {
    const html = `
      <p><a href="/pricing">View Pricing</a></p>
      <img src="/assets/hero.jpg" alt="Hero Image" />
    `;
    const md = htmlToMarkdown(html, { baseUrl: 'https://example.com' });
    expect(md).toContain('[View Pricing](https://example.com/pricing)');
    expect(md).toContain('![Hero Image](https://example.com/assets/hero.jpg)');
  });

  it('converts inline code and fenced code blocks with language', () => {
    const html = `
      <p>Use <code>npm install</code> to install.</p>
      <pre><code class="language-typescript">const x: number = 42;
console.log(x);</code></pre>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('`npm install`');
    expect(md).toContain('```typescript');
    expect(md).toContain('const x: number = 42;');
  });

  it('converts tables', () => {
    const html = `
      <table>
        <thead>
          <tr><th>Feature</th><th>Supported</th></tr>
        </thead>
        <tbody>
          <tr><td>Markdown</td><td>Yes</td></tr>
          <tr><td>JSON-LD</td><td>Yes</td></tr>
        </tbody>
      </table>
    `;
    const md = htmlToMarkdown(html);
    expect(md).toContain('| Feature | Supported |');
    expect(md).toContain('| Markdown | Yes |');
  });

  it('handles deeply nested hostile elements without call stack overflow (S-08)', () => {
    // 5,000 nested divs to verify iterative traversal and safe text extraction
    let deepHtml = 'Content at the bottom';
    for (let i = 0; i < 5000; i++) {
      deepHtml = `<div>${deepHtml}</div>`;
    }
    expect(() => htmlToMarkdown(deepHtml)).not.toThrow();
    const md = htmlToMarkdown(deepHtml);
    expect(md).toContain('Content at the bottom');
  });

  it('truncates oversized tables to avoid CPU denial of service (S-08)', () => {
    let rows = '<tr><th>ID</th><th>Value</th></tr>';
    for (let i = 1; i <= 1500; i++) {
      rows += `<tr><td>${i}</td><td>Value ${i}</td></tr>`;
    }
    const html = `<table>${rows}</table>`;
    const start = Date.now();
    const md = htmlToMarkdown(html);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Must convert quickly (<1s)
    expect(md).toContain('Table truncated');
    expect(md).toContain('| 499 | Value 499 |');
    expect(md).not.toContain('| 500 | Value 500 |');
  });

  it('safely handles malformed HTML without crashing', () => {
    const malformed = '<div><h1>Unclosed Header<p>Missing tags <b>bold</i>';
    expect(() => htmlToMarkdown(malformed)).not.toThrow();
    const md = htmlToMarkdown(malformed);
    expect(md.length).toBeGreaterThan(0);
  });

  it('prepends YAML frontmatter when includeFrontmatter is true', () => {
    const html = `
      <html>
        <head>
          <title>About AgentContent</title>
          <meta name="description" content="Developer infrastructure for agents" />
          <link rel="canonical" href="https://example.com/about" />
        </head>
        <body>
          <main>
            <h1>About AgentContent</h1>
            <p>Welcome to our library.</p>
          </main>
        </body>
      </html>
    `;
    const md = htmlToMarkdown(html, { includeFrontmatter: true });
    expect(md).toMatch(/^---/);
    expect(md).toContain('title: About AgentContent');
    expect(md).toContain('description: Developer infrastructure for agents');
    expect(md).toContain('canonical_url: https://example.com/about');
  });
});
