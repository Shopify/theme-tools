import { expect, describe, it } from 'vitest';
import { HardcodedRoutes } from './index';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: HardcodedRoutes', () => {
  it('should report offenses for hardcoded routes', async () => {
    const sourceCode = `
      <a href="/"></a>
      <form action="/search"></form>
      <a href="/cart/change"></a>
    `;

    const offenses = await runLiquidCheck(HardcodedRoutes, sourceCode);
    expect(offenses).to.have.length(3);

    const errorMessages = offenses.map((offense) => offense.message);
    expect(errorMessages).to.deep.equal([
      'Use routes object {{ routes.root_url }} instead of hardcoding /',
      'Use routes object {{ routes.search_url }} instead of hardcoding /search',
      'Use routes object {{ routes.cart_change_url }} instead of hardcoding /cart/change',
    ]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.deep.equal(['/', '/search', '/cart/change']);
  });

  it('should not report offenses for route objects', async () => {
    const sourceCode = `
      <form action="{{ routes.search_url }}"></form>
      <a href="/admin"></a>
      <a href="#MainContent"></a>
    `;

    const offenses = await runLiquidCheck(HardcodedRoutes, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
