import { describe, it, expect } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { AssetPreload } from './index';

describe('Module: AssetPreload', () => {
  it('no offense with link element', async () => {
    const sourceCode = `
      <link href="a.css" rel="stylesheet">
      <link href="b.com" rel="preconnect">
    `;

    const offenses = await runLiquidCheck(AssetPreload, sourceCode);
    expect(offenses).to.have.lengthOf(0);
  });

  it('reports stylesheet preloading', async () => {
    const sourceCode = `
      <link href="a.css" rel="preload" as="style">
    `;

    const offenses = await runLiquidCheck(AssetPreload, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal(
      'For better performance, prefer using the preload argument of the stylesheet_tag filter',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([`<link href="a.css" rel="preload" as="style">`]);
  });

  it('reports image preloading', async () => {
    const sourceCode = `
      <link href="a.png" rel="preload" as="image">
    `;

    const offenses = await runLiquidCheck(AssetPreload, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal(
      'For better performance, prefer using the preload argument of the image_tag filter',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([`<link href="a.png" rel="preload" as="image">`]);
  });

  it('reports general preloading', async () => {
    const sourceCode = `
      <link href="a.js" rel="preload" as="script">
    `;

    const offenses = await runLiquidCheck(AssetPreload, sourceCode);
    expect(offenses).to.have.lengthOf(1);
    expect(offenses[0].message).to.equal(
      'For better performance, prefer using the preload_tag filter',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([`<link href="a.js" rel="preload" as="script">`]);
  });

  it('should report offenses for manual preloading of assets', async () => {
    const sourceCode = `
      <link href="{{ 'script.js' | asset_url }}" rel="preload" as="script">
      <link href="{{ 'style.css' | asset_url }}" rel="preload" as="style">
      <link href="{{ 'image.png' | asset_url }}" rel="preload" as="image">
    `;

    const offenses = await runLiquidCheck(AssetPreload, sourceCode);
    expect(offenses).to.have.lengthOf(3);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql([
      `<link href="{{ 'script.js' | asset_url }}" rel="preload" as="script">`,
      `<link href="{{ 'style.css' | asset_url }}" rel="preload" as="style">`,
      `<link href="{{ 'image.png' | asset_url }}" rel="preload" as="image">`,
    ]);
  });
});
