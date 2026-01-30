import * as path from 'node:path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
    globalSetup: ['./src/test/test-setup.js'],
    setupFiles: ['../liquid-html-parser/build/shims.cjs'],
  },
});
