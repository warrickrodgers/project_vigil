import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@vigil/clients': resolve(__dirname, '../clients/src/index.ts'),
      '@vigil/discord': resolve(__dirname, '../discord/src/index.ts'),
      '@vigil/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@vigil/db': resolve(__dirname, '../db/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
