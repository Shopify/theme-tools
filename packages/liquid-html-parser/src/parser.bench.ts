import { bench, describe } from 'vitest';
import { THEME_FILES } from '../fixtures/theme-bundle';
import { toLiquidHtmlAST } from './index';

// Suite 1: Full theme parse — the headline metric
describe('full-theme-parse', () => {
  bench(
    'parse all 20 theme files',
    () => {
      for (const { source } of THEME_FILES) {
        toLiquidHtmlAST(source);
      }
    },
    { warmupIterations: 5, iterations: 100 },
  );
});

// Suite 2: Per-file parse — identify expensive templates
describe('per-file-parse', () => {
  for (const { path, source } of THEME_FILES) {
    bench(
      path,
      () => {
        toLiquidHtmlAST(source);
      },
      { warmupIterations: 5, iterations: 100 },
    );
  }
});
