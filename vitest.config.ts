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
    alias: {
      '@iitdeveloper/agent-content': resolve(__dirname, 'packages/core/src/index.ts'),
      '@iitdeveloper/agent-content-nextjs': resolve(__dirname, 'packages/nextjs/src/index.ts'),
      '@iitdeveloper/agent-content-node': resolve(__dirname, 'packages/node/src/index.ts'),
      '@iitdeveloper/agent-content-cli': resolve(__dirname, 'packages/cli/src/index.ts'),
      // Backwards-compatible aliases for internal monorepo resolution
      '@iitdeveloper/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@iitdeveloper/nextjs': resolve(__dirname, 'packages/nextjs/src/index.ts'),
      '@iitdeveloper/node': resolve(__dirname, 'packages/node/src/index.ts'),
      '@iitdeveloper/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
    },
  },
});
