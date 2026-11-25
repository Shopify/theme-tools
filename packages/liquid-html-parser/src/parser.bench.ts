import { bench, describe } from 'vitest';
import { THEME_FILES } from '../fixtures/theme-bundle';
import { toLiquidHtmlAST } from './index';

// Suite 1: Full theme parse — the headline metric
describe('full-theme-parse', () => {
  bench(
    `parse all ${THEME_FILES.length} theme files`,
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

// Repeated independent raw bodies should scale with the source size.
describe('raw-body-boundaries', () => {
  for (const count of [1000, 4000]) {
    for (const [name, section] of [
      ['unfinished-raw', '{% raw %}{{ unfinished {% endraw %}{{ 1 }}'],
      ['script-comparison', '<script>a<b</script>{{ value }}'],
      ['comments', '<!-- storefront comment -->'],
    ]) {
      const source = section.repeat(count);
      bench(`${name} x ${count}`, () => toLiquidHtmlAST(source));
    }
  }
});
