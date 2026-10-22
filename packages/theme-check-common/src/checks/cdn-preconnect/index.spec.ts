import { expect, describe, it } from 'vitest';
import { runLiquidCheck } from '../../test';
import { CdnPreconnect } from './index';

describe('Module: CdnPreconnect', () => {
  it('should report preconnect to cdn.shopify.com', async () => {
    const sourceCode = `
      <link rel="preconnect" href="https://cdn.shopify.com/"/>
    `;

    const offenses = await runLiquidCheck(CdnPreconnect, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance',
    );
  });

  it('should report crossorigin preconnect to cdn.shopify.com', async () => {
    const sourceCode = `
      <link rel="preconnect" href="https://cdn.shopify.com/" crossorigin/>
    `;

    const offenses = await runLiquidCheck(CdnPreconnect, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance',
    );
  });

  it('should report preconnect to cdn.shopify.com without a trailing slash', async () => {
    const sourceCode = `
      <link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
      <link rel="preconnect" href="//cdn.shopify.com">
    `;

    const offenses = await runLiquidCheck(CdnPreconnect, sourceCode);
    expect(offenses).to.have.length(2);
  });

  it('should not report preconnect to other hosts', async () => {
    const sourceCode = `
      <link rel="preconnect" href="https://fonts.shopifycdn.com" crossorigin>
      <link rel="preconnect" href="https://example.com/cdn.shopify.com.html">
    `;

    const offenses = await runLiquidCheck(CdnPreconnect, sourceCode);
    expect(offenses).to.have.length(0);
  });

  it('should not report other link types', async () => {
    const sourceCode = `
      <link rel="preload" href="https://example.com/foo.css" as="style"/>
      <link rel="stylesheet" href="https://example.com/bar.css"/>
      <link rel="icon"/>
    `;

    const offenses = await runLiquidCheck(CdnPreconnect, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
