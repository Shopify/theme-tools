import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { ImgWidthAndHeight } from './index';

describe('Module: ImgWidthAndHeight', () => {
  it('should report missing attributes on multiple img tags with mixed attributes', async () => {
    const sourceCode = `
      <img src="example1.jpg" width="100" height="100">
      <img src="example2.jpg" width="100">
      <img src="example3.jpg" height="100">
      <img src="example4.jpg">
    `;

    const offenses = await runLiquidCheck(ImgWidthAndHeight, sourceCode);
    expect(offenses).to.have.lengthOf(3);
    expect(offenses[0].message).to.equal('Missing height attribute on img tag');
    expect(offenses[1].message).to.equal('Missing width attribute on img tag');
    expect(offenses[2].message).to.equal('Missing width and height attributes on img tag');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([
      '<img src="example2.jpg" width="100">',
      '<img src="example3.jpg" height="100">',
      '<img src="example4.jpg">',
    ]);
  });

  it('should report missing width and height attributes on img tags', async () => {
    const sourceCode = `
      <a-{{ product.id }} href="example.com">content</a-{{ product.id }}>
      <input type="submit">
      <img src="example.jpg">
    `;

    const offenses = await runLiquidCheck(ImgWidthAndHeight, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal('Missing width and height attributes on img tag');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['<img src="example.jpg">']);
  });

  it('should report missing height attribute on img tags', async () => {
    const sourceCode = `
      <input type="submit">
      <img src="example.jpg" width="100">
    `;

    const offenses = await runLiquidCheck(ImgWidthAndHeight, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal('Missing height attribute on img tag');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['<img src="example.jpg" width="100">']);
  });

  it('should report missing width attribute on img tags', async () => {
    const sourceCode = `
      <input type="submit">
      <img src="example.jpg" height="100">
    `;

    const offenses = await runLiquidCheck(ImgWidthAndHeight, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal('Missing width attribute on img tag');

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['<img src="example.jpg" height="100">']);
  });

  it('should not report missing attributes on img tags if they are not missing', async () => {
    const sourceCode = `
      <img src="example.jpg" width="100" height="100">
    `;

    const offenses = await runLiquidCheck(ImgWidthAndHeight, sourceCode);
    expect(offenses).to.be.empty;
  });
});
