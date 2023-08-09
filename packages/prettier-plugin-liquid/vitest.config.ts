import * as path from 'node:path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude],
    singleThread: true,
    globalSetup: ['./test/test-setup.js'],
    setupFiles: ['./build/shims.js'],
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
});
