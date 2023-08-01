import { expect, describe, it } from 'vitest';
import { runLiquidCheck } from '../../test';
import { DeprecateLazysizes } from './index';

describe('Module: DeprecateLazysizes', () => {
  it('should report data-srcset and data-sizes attributes', async () => {
    const sourceCode = `
      <img data-srcset="image.jpg" data-sizes="auto" class="lazyload" />
    `;

    const offenses = await runLiquidCheck(DeprecateLazysizes, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Use the native loading="lazy" attribute instead of lazysizes',
    );
  });

  it('should not report srcset and sizes attributes', async () => {
    const sourceCode = `
      <img srcset="image.jpg" sizes="auto" loading="lazy" />
    `;

    const offenses = await runLiquidCheck(DeprecateLazysizes, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
