#!/usr/bin/env node
/**
 * External Consumer Verification Script
 * Packs all packages into .tgz tarballs, creates an isolated temporary consumer project,
 * installs the tarballs via npm, and asserts ESM, CJS, and CLI execution work out of the box.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT_DIR = process.cwd();
const PACKAGES = [
  { name: '@iitdeveloper/agent-content', dir: 'packages/core' },
  { name: '@iitdeveloper/agent-content-nextjs', dir: 'packages/nextjs' },
  { name: '@iitdeveloper/agent-content-node', dir: 'packages/node' },
  { name: '@iitdeveloper/agent-content-cli', dir: 'packages/cli' },
];

console.log('📦 Step 1: Packing monorepo packages with pnpm pack...');
const tarballs = {};
for (const pkg of PACKAGES) {
  const pkgDir = resolve(ROOT_DIR, pkg.dir);
  const output = execSync('pnpm pack', { cwd: pkgDir, encoding: 'utf8' }).trim();
  const tarballName = output.split('\n').filter(line => line.endsWith('.tgz')).pop().trim();
  tarballs[pkg.name] = resolve(pkgDir, tarballName);
  console.log(`  ✓ Packed ${pkg.name} -> ${tarballName}`);
}

const testDir = join(tmpdir(), `agent-content-ci-consumer-${Date.now()}`);
mkdirSync(testDir, { recursive: true });
console.log(`\n🧪 Step 2: Created isolated consumer directory: ${testDir}`);

try {
  // Initialize consumer package.json
  writeFileSync(
    join(testDir, 'package.json'),
    JSON.stringify(
      {
        name: 'ci-consumer-test',
        type: 'module',
      },
      null,
      2
    )
  );

  console.log('\n📥 Step 3: Installing packed tarballs via npm in isolated consumer...');
  const tarballPaths = Object.values(tarballs).map(t => `"${t}"`).join(' ');
  execSync(`npm install --no-audit --no-fund ${tarballPaths}`, { cwd: testDir, stdio: 'inherit' });

  console.log('\n🔍 Step 4: Testing ESM imports and single-package re-exports...');
  const esmTestScript = `
    import { ContentRegistry, htmlToMarkdown, getRequestedFormat } from '@iitdeveloper/agent-content';
    import { createAgentContentHandler, ContentRegistry as NextRegistry, shouldRewriteToMarkdown } from '@iitdeveloper/agent-content-nextjs';
    import { agentContent, ContentRegistry as NodeRegistry } from '@iitdeveloper/agent-content-node';

    // Verify core
    const reg = new ContentRegistry();
    if (!reg) throw new Error('Failed to instantiate ContentRegistry from core');

    // Verify Next.js re-export
    const nextReg = new NextRegistry();
    if (!nextReg) throw new Error('Failed to instantiate ContentRegistry from nextjs re-export');
    if (typeof createAgentContentHandler !== 'function') throw new Error('createAgentContentHandler is not a function');
    if (typeof shouldRewriteToMarkdown !== 'function') throw new Error('shouldRewriteToMarkdown is not a function');

    // Verify Node re-export
    const nodeReg = new NodeRegistry();
    if (!nodeReg) throw new Error('Failed to instantiate ContentRegistry from node re-export');
    if (typeof agentContent !== 'function') throw new Error('agentContent is not a function');

    console.log('  ✓ ESM imports and re-exports passed cleanly!');
  `;
  writeFileSync(join(testDir, 'test-esm.js'), esmTestScript, 'utf8');
  execSync('node test-esm.js', { cwd: testDir, stdio: 'inherit' });

  console.log('\n🔍 Step 5: Testing CommonJS require...');
  const cjsTestScript = `
    const core = require('@iitdeveloper/agent-content');
    const node = require('@iitdeveloper/agent-content-node');

    if (typeof core.getRequestedFormat !== 'function') throw new Error('CJS getRequestedFormat failed');
    if (typeof node.agentContent !== 'function') throw new Error('CJS node agentContent failed');
    console.log('  ✓ CommonJS require passed cleanly!');
  `;
  writeFileSync(join(testDir, 'test-cjs.cjs'), cjsTestScript, 'utf8');
  execSync('node test-cjs.cjs', { cwd: testDir, stdio: 'inherit' });

  console.log('\n🔍 Step 6: Testing CLI binaries...');
  const binDir = join(testDir, 'node_modules', '.bin');
  const agentContentHelp = execSync(`${join(binDir, 'agent-content')} --help`, { encoding: 'utf8' });
  if (!agentContentHelp.includes('Usage: agent-content')) {
    throw new Error('agent-content binary output invalid');
  }
  const cliHelp = execSync(`${join(binDir, 'agent-content-cli')} --help`, { encoding: 'utf8' });
  if (!cliHelp.includes('Usage: agent-content')) {
    throw new Error('agent-content-cli binary output invalid');
  }
  console.log('  ✓ Both CLI binaries (agent-content and agent-content-cli) executed successfully!');

  console.log('\n✅ All packed tarball validations passed successfully!\n');
} finally {
  // Cleanup
  rmSync(testDir, { recursive: true, force: true });
  for (const tgz of Object.values(tarballs)) {
    if (existsSync(tgz)) rmSync(tgz, { force: true });
  }
}
