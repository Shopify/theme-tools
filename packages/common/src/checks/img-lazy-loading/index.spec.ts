import { describe, it, expect } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { ImgLazyLoading } from './index';

describe('Module: ImgLazyLoading', () => {
  it('should report missing loading attribute', async () => {
    const sourceCode = `
      <img src="image.jpg" alt="An image">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];

    expect(offenses).toHaveLength(1);
    expect(offense.message).to.equal(
      'Improve performance using loading="eager" or loading="lazy".',
    );

    expect(offense.suggest).toHaveLength(2);

    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Add loading="lazy" for below the fold content');
    expect(offense.suggest[1].message).to.equal('Add loading="eager" for above the fold content');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`<img src="image.jpg" alt="An image">`);
  });

  it('should report deprecated loading="auto" attribute', async () => {
    const sourceCode = `
      <img src="image.jpg" alt="An image" loading="auto">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];

    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Replace with loading="lazy"');
    expect(offense.suggest[1].message).to.equal('Replace with loading="eager"');

    expect(offenses).toHaveLength(1);
    expect(offense.message).to.equal(
      'The loading="auto" attribute is deprecated, use loading="lazy" or loading="eager" instead.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`loading="auto"`);
  });

  it('should not report any offense with loading="lazy" attribute', async () => {
    const sourceCode = `
      <img src="a.jpg" loading="lazy">
      <img src="a.jpg" loading="eager">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    expect(offenses).toHaveLength(0);
  });

  it('should report missing loading="lazy" attribute', async () => {
    const sourceCode = `
      <img src="a.jpg">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).to.equal(
      'Improve performance using loading="eager" or loading="lazy".',
    );

    expect(offense.suggest).toHaveLength(2);

    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Add loading="lazy" for below the fold content');
    expect(offense.suggest[1].message).to.equal('Add loading="eager" for above the fold content');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`<img src="a.jpg">`);
  });

  it('should prefer using lazy as opposed to auto', async () => {
    const sourceCode = `
      <img src="a.jpg" loading="auto">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];

    expect(offenses).toHaveLength(1);
    expect(offense.message).to.equal(
      'The loading="auto" attribute is deprecated, use loading="lazy" or loading="eager" instead.',
    );

    expect(offense.suggest).toHaveLength(2);
    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Replace with loading="lazy"');
    expect(offense.suggest[1].message).to.equal('Replace with loading="eager"');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`loading="auto"`);
  });

  it('should suggest adding loading="lazy" attribute', async () => {
    const sourceCode = `
      <img src="image.jpg" alt="An image">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];

    expect(offenses).toHaveLength(1);
    expect(offense.message).to.equal(
      'Improve performance using loading="eager" or loading="lazy".',
    );
    expect(offense.suggest).toHaveLength(2);

    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Add loading="lazy" for below the fold content');
    expect(offense.suggest[1].message).to.equal('Add loading="eager" for above the fold content');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`<img src="image.jpg" alt="An image">`);
  });

  it('should suggest replacing loading="auto" with loading="lazy"', async () => {
    const sourceCode = `
      <img src="image.jpg" alt="An image" loading="auto">
    `;
    const offenses = await runLiquidCheck(ImgLazyLoading, sourceCode);
    const offense = offenses[0];

    expect(offenses).toHaveLength(1);
    expect(offense.message).to.equal(
      'The loading="auto" attribute is deprecated, use loading="lazy" or loading="eager" instead.',
    );

    expect(offense.suggest).toHaveLength(2);
    if (!offense.suggest) return;

    expect(offense.suggest[0].message).to.equal('Replace with loading="lazy"');
    expect(offense.suggest[1].message).to.equal('Replace with loading="eager"');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);

    expect(highlights).toHaveLength(1);
    expect(highlights[0]).to.equal(`loading="auto"`);
  });
});
