import * as path from 'node:path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude],
    pool: 'forks',
    maxWorkers: 1,
    isolate: true,
    globalSetup: ['./src/test/test-setup.js'],
  },
});
