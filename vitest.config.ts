import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**'],
      exclude: ['**/dist/**', '**/node_modules/**', '**/examples/**', '**/*.d.ts'],
    },
  },
  resolve: {
    // Exact-match aliases so that package subpaths (e.g. '@iitdeveloper/agent-content/negotiation')
    // resolve to their own source modules instead of being appended to the index path.
    alias: [
      {
        find: /^@iitdeveloper\/agent-content\/(negotiation|markdown|content|metadata|discovery|cache|security|types)$/,
        replacement: resolve(__dirname, 'packages/core/src/$1/index.ts'),
      },
      { find: /^@iitdeveloper\/agent-content-nextjs\/proxy$/, replacement: resolve(__dirname, 'packages/nextjs/src/proxy.ts') },
      { find: /^@iitdeveloper\/agent-content$/, replacement: resolve(__dirname, 'packages/core/src/index.ts') },
      { find: /^@iitdeveloper\/agent-content-nextjs$/, replacement: resolve(__dirname, 'packages/nextjs/src/index.ts') },
      { find: /^@iitdeveloper\/agent-content-node$/, replacement: resolve(__dirname, 'packages/node/src/index.ts') },
      { find: /^@iitdeveloper\/agent-content-cli$/, replacement: resolve(__dirname, 'packages/cli/src/index.ts') },
    ],
  },
});
