import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const CI = !!process.env.CI;
/** In CI prettier plugin tests are covered by a different run command */
const ciExclude = ['./packages/prettier-plugin-liquid'];

const exclude = [...configDefaults.exclude, './packages/vscode-extension/out/**'];

export default defineConfig({
  test: {
    exclude: CI ? [...exclude, ...ciExclude] : exclude,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
    setupFiles: [
      './packages/theme-check-common/src/test/test-setup.ts',
      './packages/theme-language-server-common/src/test/test-setup.ts',
    ],
  },
});
