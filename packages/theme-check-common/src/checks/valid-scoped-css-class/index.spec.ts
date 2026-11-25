import { expect, describe, it } from 'vitest';
import { ValidScopedCSSClass } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: ValidScopedCSSClass', () => {
  describe('graceful degradation', () => {
    it('reports no offenses when getReferences is unavailable', async () => {
      const sourceCode = `
        <div class="undefined-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        {},
      );
      expect(offenses).toHaveLength(0);
    });

    it('reports no offenses when getDependencies is unavailable', async () => {
      const sourceCode = `
        <div class="undefined-class">Hello</div>
      `;
      const offenses = await runLiquidCheck(
        ValidScopedCSSClass,
        sourceCode,
        'sections/section.liquid',
        { getReferences: async () => [] },
      );
      expect(offenses).toHaveLength(0);
    });
  });
});
