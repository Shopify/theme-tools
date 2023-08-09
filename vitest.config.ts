import path from 'path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude],
    singleThread: true,
    setupFiles: [
      './packages/theme-check-common/src/test/test-setup.ts',
      './packages/theme-language-server-common/src/test/test-setup.ts',
    ],
    alias: {
      '~': path.resolve(__dirname, './packages/prettier-plugin-liquid/src'),
    },
  },
});
