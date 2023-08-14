import path from 'path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const CI = !!process.env.CI;
const prettierPluginExclude = ['./packages/prettier-plugin-liquid'];

export default defineConfig({
  test: {
    exclude: CI ? [...configDefaults.exclude, ...prettierPluginExclude] : configDefaults.exclude,
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
