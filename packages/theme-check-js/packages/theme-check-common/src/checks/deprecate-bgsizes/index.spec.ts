import { expect, describe, it } from 'vitest';
import { DeprecateBgsizes } from './index';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: DeprecateBgsizes', () => {
  it('should report offenses for deprecated attributes', async () => {
    const sourceCode = `
      <div class="lazyload" data-bgset="image.jpg"></div>
      <div class="lazyload" data-bgset="image2.jpg"></div>
    `;

    const offenses = await runLiquidCheck(DeprecateBgsizes, sourceCode);
    expect(offenses).to.have.length(4);

    const errorMessages = offenses.map((offense) => offense.message);
    expect(errorMessages).to.deep.equal([
      'Use the native loading="lazy" attribute instead of lazysizes',
      'Use the CSS imageset attribute instead of data-bgset',
      'Use the native loading="lazy" attribute instead of lazysizes',
      'Use the CSS imageset attribute instead of data-bgset',
    ]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.deep.equal([
      'lazyload',
      'data-bgset="image.jpg"',
      'lazyload',
      'data-bgset="image2.jpg"',
    ]);
  });

  it('should not report offenses for non-deprecated attributes', async () => {
    const sourceCode = `
      <div class="non-lazyload" data-non-bgset="image.jpg"></div>
      <div class="non-lazyload" data-non-bgset="image2.jpg"></div>
    `;

    const offenses = await runLiquidCheck(DeprecateBgsizes, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
