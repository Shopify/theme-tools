import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const CI = !!process.env.CI;
const prettierPluginExclude = ['./packages/prettier-plugin-liquid'];

export default defineConfig({
  test: {
    exclude: CI ? [...configDefaults.exclude, ...prettierPluginExclude] : configDefaults.exclude,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: true,
      },
    },
    setupFiles: [
      './packages/theme-check-common/src/test/test-setup.ts',
      './packages/theme-language-server-common/src/test/test-setup.ts',
    ],
  },
});
