import { defineConfig } from 'vitest/config';
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
    setupFiles: [
      '../theme-check-common/src/test/test-setup.ts',
      './src/test/test-setup.ts',
    ],
  },
});
