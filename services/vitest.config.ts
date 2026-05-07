import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@vigil/clients': resolve(__dirname, '../packages/clients/src/index.ts'),
      '@vigil/discord': resolve(__dirname, '../packages/discord/src/index.ts'),
      '@vigil/shared': resolve(__dirname, '../packages/shared/src/index.ts'),
      '@vigil/db': resolve(__dirname, '../packages/db/src/index.ts'),
      '@vigil/agents': resolve(__dirname, '../packages/agents/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
