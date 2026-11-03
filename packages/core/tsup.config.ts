import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'negotiation/index': 'src/negotiation/index.ts',
    'markdown/index': 'src/markdown/index.ts',
    'content/index': 'src/content/index.ts',
    'metadata/index': 'src/metadata/index.ts',
    'discovery/index': 'src/discovery/index.ts',
    'cache/index': 'src/cache/index.ts',
    'security/index': 'src/security/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
});

