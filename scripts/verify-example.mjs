#!/usr/bin/env node
/**
 * Builds and serves examples/single-source-of-truth exactly as a consumer would, then smoke-tests it.
 *
 * The example is copied to a temp directory and installed from the PACKED tarballs (not workspace
 * links), so this exercises the published file layout, exports maps and declarations. It then runs
 * `next build` (which type-checks the React app) and `next start`, and asserts over HTTP that the one
 * typed content model drives both the HTML pages and the Markdown output.
 *
 * Usage: node scripts/verify-example.mjs   (run `pnpm build` first)
 */
import { execSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const EXAMPLE = resolve(ROOT, 'examples/single-source-of-truth');
const PORT = 3900 + Math.floor(Math.random() * 90);
const work = join(tmpdir(), `agent-content-example-${Date.now()}`);
const packs = join(work, 'packs');
const app = join(work, 'app');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
};

mkdirSync(packs, { recursive: true });
let server;

try {
  console.log('📦 Packing core + Next.js adapter...');
  for (const dir of ['core', 'nextjs']) {
    run(`pnpm pack --pack-destination "${packs}"`, resolve(ROOT, 'packages', dir));
  }

  console.log('\n📁 Copying the example to an isolated directory...');
  cpSync(EXAMPLE, app, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|\.next)([\\/]|$)/.test(src) && !src.endsWith('next-env.d.ts'),
  });

  // Swap the workspace link for the packed tarballs; everything else stays as shipped.
  const pkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
  delete pkg.dependencies['@iitdeveloper/agent-content-nextjs'];
  writeFileSync(join(app, 'package.json'), JSON.stringify(pkg, null, 2));

  console.log('\n📥 Installing from tarballs...');
  const adapter = join(packs, 'iitdeveloper-agent-content-nextjs-0.1.0.tgz');
  const core = join(packs, 'iitdeveloper-agent-content-0.1.0.tgz');
  run(`npm install --no-audit --no-fund "${adapter}" "${core}"`, app);

  console.log('\n🏗️  next build (includes type-check)...');
  run('npx next build', app);

  console.log('\n🚀 next start...');
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: app, stdio: 'ignore' });
  const base = `http://localhost:${PORT}`;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/`)).ok) break;
    } catch {
      /* server not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });
  const isMd = (res) => (res.headers.get('content-type') ?? '').startsWith('text/markdown');
  const isHtml = (res) => (res.headers.get('content-type') ?? '').startsWith('text/html');
  const MD = { accept: 'text/markdown' };

  console.log('\n🔍 HTML (human) output from the shared model...');
  let res = await get('/services', { accept: 'text/html' });
  let html = await res.text();
  assert(res.status === 200 && isHtml(res), '/services → HTML');
  assert(html.includes('<title>Services</title>'), 'generateMetadata title comes from the model');
  assert(html.includes('content="Web development, data pipelines and AI integration."'), 'generateMetadata description comes from the model');
  assert(html.includes('<h2>Web development</h2>') && html.includes('<li>Design systems</li>'), 'sections and lists rendered as JSX from the model');

  res = await get('/', { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });
  html = await res.text();
  assert(res.status === 200 && isHtml(res) && html.includes('What we do'), '/ → HTML for browsers');

  console.log('\n🔍 Markdown (agent) output from the same model...');
  res = await get('/services', MD);
  let md = await res.text();
  assert(res.status === 200 && isMd(res), '/services + Accept: text/markdown → Markdown');
  assert(md.startsWith('---\ntitle: Services\n') && md.includes('canonical_url: https://acme.example/services'), 'frontmatter derived from the model');
  assert(md.includes('## Web development') && md.includes('- Design systems') && md.includes('- SEO'), 'sections and lists rendered as Markdown from the model');
  assert(/```jsonld\n[\s\S]*"@type": "WebPage"[\s\S]*```/.test(md), 'JSON-LD block present (render.includeStructuredData)');
  assert(!md.includes('metadata:'), 'metadata stays off unless enabled');

  for (const [path, headers, label] of [
    ['/services.md', {}, '/services.md'],
    ['/services?format=md', {}, '/services?format=md'],
    ['/services/index.md', {}, '/services/index.md'],
  ]) {
    res = await get(path, headers);
    assert(res.status === 200 && isMd(res) && (await res.text()).includes('## Web development'), `${label} → Markdown`);
  }

  console.log('\n🔍 Root page (optional catch-all route)...');
  res = await get('/', MD);
  md = await res.text();
  assert(res.status === 200 && isMd(res) && md.includes('title: Acme Studio') && md.includes('## What we do'), '/ + Accept: text/markdown → Markdown');
  for (const path of ['/?format=md', '/index.md', '/.md']) {
    res = await get(path);
    assert(res.status === 200 && isMd(res) && (await res.text()).includes('## What we do'), `${path} → Markdown`);
  }
  res = await get('/', { accept: 'text/markdown;q=0, text/html' });
  assert(res.status === 200 && isHtml(res), '/ + Accept: text/markdown;q=0 → HTML');

  console.log('\n🔍 Drafts stay private...');
  for (const [path, headers] of [['/roadmap', {}], ['/roadmap.md', {}], ['/roadmap/index.md', {}], ['/roadmap', MD]]) {
    res = await get(path, headers);
    assert(res.status === 404 && !(await res.text()).includes('Not public yet'), `${path}${headers.accept ? ' (Accept: markdown)' : ''} → 404, no draft content`);
  }

  console.log('\n🔍 Discovery...');
  res = await get('/llms.txt');
  const llms = await res.text();
  assert(res.status === 200 && llms.includes('# Acme Studio') && llms.includes('/services'), '/llms.txt lists published pages');
  assert(!llms.toLowerCase().includes('roadmap'), '/llms.txt omits the draft page');

  console.log('\n✅ single-source-of-truth example build + smoke test passed.\n');
} finally {
  if (server) server.kill('SIGTERM');
  rmSync(work, { recursive: true, force: true });
}
