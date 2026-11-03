#!/usr/bin/env node
/**
 * Real Next.js consumer verification.
 *
 * Packs the monorepo packages, installs ONLY the Next.js adapter tarball (plus the core tarball it
 * depends on) into a fresh Next.js App Router project, runs `next build` and `next start`, and
 * asserts the documented behaviour over HTTP. This is what catches bundler/runtime regressions that
 * unit tests (which alias to `src`) cannot see.
 *
 * Usage: NEXT_VERSION=14|15|16 node scripts/verify-nextjs.mjs   (default: 15)
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const NEXT_VERSION = process.env.NEXT_VERSION ?? '15';
const REACT_VERSION = NEXT_VERSION === '14' ? '18' : '19';
const PORT = 3400 + Math.floor(Math.random() * 500);
const ROOT = process.cwd();
const work = join(tmpdir(), `agent-content-next${NEXT_VERSION}-${Date.now()}`);
const packs = join(work, 'packs');
const app = join(work, 'app');

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' });
const write = (path, body) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body, 'utf8');
};
const assert = (cond, message) => {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
};

mkdirSync(packs, { recursive: true });
mkdirSync(app, { recursive: true });
let server;

try {
  console.log(`📦 Packing packages (Next.js ${NEXT_VERSION}, React ${REACT_VERSION})...`);
  for (const dir of ['core', 'nextjs']) {
    run(`pnpm pack --pack-destination "${packs}"`, resolve(ROOT, 'packages', dir));
  }
  const core = join(packs, 'iitdeveloper-agent-content-0.1.0.tgz');
  const adapter = join(packs, 'iitdeveloper-agent-content-nextjs-0.1.0.tgz');

  write(
    join(app, 'package.json'),
    JSON.stringify({
      name: 'next-consumer',
      private: true,
      dependencies: {
        next: NEXT_VERSION,
        react: REACT_VERSION,
        'react-dom': REACT_VERSION,
        typescript: '5',
        '@types/react': REACT_VERSION,
        '@types/node': '22',
      },
    })
  );
  write(
    join(app, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022', lib: ['dom', 'esnext'], jsx: 'preserve', module: 'esnext', moduleResolution: 'bundler',
        strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true, isolatedModules: true,
        incremental: true, allowJs: true, resolveJsonModule: true, plugins: [{ name: 'next' }],
        paths: { '@/*': ['./*'] },
      },
      include: ['**/*.ts', '**/*.tsx', 'next-env.d.ts', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    })
  );

  // Exactly the files shown in the README quickstart.
  write(
    join(app, 'agent-content.config.ts'),
    `import { defineAgentContent } from '@iitdeveloper/agent-content-nextjs';
export const agentContent = defineAgentContent({
  site: { name: 'Acme', url: 'http://localhost:${PORT}' },
  pages: [
    { url: '/', title: 'Home', content: '# Home\\n\\nRoot page markdown.', status: 'published', updatedAt: '2026-11-01' },
    { url: '/about', title: 'About', content: '# About\\n\\nStructured about page.', status: 'published', updatedAt: '2026-11-01' },
    { url: '/secret', title: 'Secret', content: 'draft', status: 'draft' },
  ],
});
`
  );
  write(join(app, 'app/layout.tsx'), `export default function L({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}\n`);
  write(join(app, 'app/page.tsx'), `export default function P(){return <main><h1>Home</h1></main>}\n`);
  write(join(app, 'app/about/page.tsx'), `export default function P(){return <main><h1>About HTML</h1></main>}\n`);
  write(
    join(app, 'app/api/agent-content/[[...slug]]/route.ts'),
    `import { createAgentContentHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';
export const { GET, HEAD } = createAgentContentHandler({ content: agentContent });
`
  );
  write(
    join(app, 'app/llms.txt/route.ts'),
    `import { createLlmsTxtHandler } from '@iitdeveloper/agent-content-nextjs';
import { agentContent } from '@/agent-content.config';
export const { GET, HEAD } = createLlmsTxtHandler(agentContent);
`
  );
  write(
    join(app, NEXT_VERSION === '16' ? 'proxy.ts' : 'middleware.ts'),
    `import { NextResponse, type NextRequest } from 'next/server';
import { shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs/proxy';

export default function proxy(request: NextRequest) {
  const decision = shouldRewriteToMarkdown(request);

  if (decision.rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = \`/api/agent-content\${request.nextUrl.pathname}\`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
`
  );

  console.log('\n📥 Installing adapter + core tarballs and Next.js...');
  run(`npm install --no-audit --no-fund "${adapter}" "${core}"`, app);

  console.log('\n🏗️  next build...');
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

  console.log('\n🔍 Asserting documented behaviour...');
  const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });

  let res = await get('/about', { accept: 'text/markdown' });
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), 'Accept: text/markdown → Markdown');
  assert((res.headers.get('vary') ?? '').toLowerCase().includes('accept'), 'Markdown response carries Vary: Accept');
  assert((res.headers.get('etag') ?? '').startsWith('W/"md-'), 'Markdown ETag is representation-specific');
  assert((await res.text()).includes('# About'), 'Markdown body rendered from the structured registry');

  res = await get('/about.md');
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), '/about.md → Markdown');

  res = await get('/about?format=md');
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), '/about?format=md → Markdown');

  res = await get('/about', { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });
  assert((res.headers.get('content-type') ?? '').startsWith('text/html'), 'Browser Accept → HTML');

  res = await get('/about', { accept: 'text/markdown;q=0, text/html' });
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/html'), 'Accept text/markdown;q=0 → HTML (not 404)');

  res = await get('/about/index.md');
  assert(res.status === 200 && (await res.text()).includes('# About'), '/about/index.md → Markdown of /about');

  // Root page (regression: a required [...slug] catch-all never matched /api/agent-content)
  res = await get('/', { accept: 'text/markdown' });
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), 'ROOT: Accept: text/markdown → Markdown');
  assert((res.headers.get('vary') ?? '').toLowerCase().includes('accept'), 'ROOT: Markdown response carries Vary: Accept');
  assert((await res.text()).includes('Root page markdown.'), 'ROOT: Markdown body comes from the registry');

  res = await get('/?format=md');
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), 'ROOT: /?format=md → Markdown');

  res = await get('/index.md');
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), 'ROOT: /index.md → Markdown');
  assert((await res.text()).includes('Root page markdown.'), 'ROOT: /index.md serves the root page body');

  res = await get('/.md');
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/markdown'), 'ROOT: /.md → Markdown');

  res = await get('/', { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/html'), 'ROOT: browser Accept → HTML');
  assert((await res.text()).includes('<h1>Home</h1>'), 'ROOT: browser HTML is the React page');

  res = await get('/');
  assert((res.headers.get('content-type') ?? '').startsWith('text/html'), 'ROOT: no Accept header → HTML');

  res = await get('/', { accept: 'text/markdown;q=0, text/html' });
  assert(res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/html'), 'ROOT: Accept text/markdown;q=0 → HTML');

  res = await get('/secret.md');
  assert(res.status === 404, 'Draft page is not exposed (404)');

  res = await get('/secret/index.md');
  assert(res.status === 404, 'Draft page is not exposed via /secret/index.md (404)');

  res = await get('/secret', { accept: 'text/markdown' });
  assert(res.status === 404 && !(await res.text()).includes('draft'), 'Draft page is not exposed via Accept (404)');

  res = await get('/llms.txt');
  const llmsBody = await res.text();
  assert(res.status === 200 && llmsBody.includes('# Acme'), '/llms.txt served');
  assert(!llmsBody.includes('Secret') && !llmsBody.includes('/secret'), '/llms.txt omits draft pages');

  console.log(`\n✅ Next.js ${NEXT_VERSION} consumer verification passed.\n`);
} finally {
  if (server) server.kill('SIGTERM');
  rmSync(work, { recursive: true, force: true });
}
