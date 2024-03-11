import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const CI = !!process.env.CI;
/** In CI prettier plugin tests are covered by a different run command */
const ciExclude = ['./packages/prettier-plugin-liquid'];

/** lang-jsonc uses a test.each which isn't compatible with the vitest VS Code extension. */
const devExclude = ['./packages/lang-jsonc'];

export default defineConfig({
  test: {
    exclude: CI
      ? [...configDefaults.exclude, ...ciExclude]
      : [...configDefaults.exclude, ...devExclude],
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
