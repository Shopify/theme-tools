import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

const CI = !!process.env.CI;
/** Browser tests run via @vscode/test-web, not Vitest */
const alwaysExclude = ['**/browser/test/**', '**/test/browser/**'];
/** In CI prettier plugin tests are covered by a different run command */
const ciExclude = ['./packages/prettier-plugin-liquid'];
/**
 * Test files that need a fresh module graph. Most mock a dependency of a module
 * that another test file already loaded. ObjectCompletionProvider depends on a
 * module-level memo in TypeSystem.
 */
const isolatedTests = [
  'packages/release-orchestrator/src/steps/getPackageJsonRecord.spec.ts',
  'packages/theme-check-common/src/checks/asset-size-css/index.spec.ts',
  'packages/theme-check-common/src/checks/asset-size-javascript/index.spec.ts',
  'packages/theme-language-server-common/src/completions/providers/ContentForParameterCompletionProvider.spec.ts',
  'packages/theme-language-server-common/src/completions/providers/ObjectCompletionProvider.spec.ts',
];

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ...alwaysExclude, ...(CI ? ciExclude : [])],
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    setupFiles: [
      './packages/theme-check-common/src/test/test-setup.ts',
      './packages/theme-language-server-common/src/test/test-setup.ts',
    ],
    projects: [
      { extends: true, test: { name: 'shared', exclude: isolatedTests } },
      { extends: true, test: { name: 'isolated', include: isolatedTests, isolate: true } },
    ],
  },
});
