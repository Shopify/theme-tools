import { expect, describe, it } from 'vitest';
import { HardcodedRoutes } from './index';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: HardcodedRoutes', () => {
  it('should report offenses for hardcoded routes', async () => {
    const sourceCode = `
      <a href="/"></a>
      <form action="/search"></form>
      <a href="/account/login"></a>
      <a href="/collections/{{ collection.handle }}"></a>
      <a href="/cart/change?line={{ forloop.index }}&amp;quantity=0"></a>
      <li>{{ 'Socks' | link_to: '/collections/socks' }}</li>
      <li>{{ 'Home' | link_to: '/' }}</li>
      <li>{{ 'Cart (' | append: cart.item_count | append: ')' | link_to: '/cart' }}</li>
    `;

    const offenses = await runLiquidCheck(HardcodedRoutes, sourceCode);
    expect(offenses).to.have.length(8);

    const errorMessages = offenses.map((offense) => offense.message);
    expect(errorMessages).to.deep.equal([
      'Use routes object {{ routes.root_url }} instead of hardcoding /',
      'Use routes object {{ routes.search_url }} instead of hardcoding /search',
      'Use routes object {{ routes.account_login_url }} instead of hardcoding /account/login',
      'Use routes object {{ routes.collections_url }} instead of hardcoding /collections',
      'Use routes object {{ routes.cart_change_url }} instead of hardcoding /cart/change',
      'Use routes object {{ routes.collections_url }} instead of hardcoding /collections',
      'Use routes object {{ routes.root_url }} instead of hardcoding /',
      'Use routes object {{ routes.cart_url }} instead of hardcoding /cart',
    ]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.deep.equal([
      '/',
      '/search',
      '/account/login',
      '/collections',
      '/cart/change',
      '/collections',
      '/',
      '/cart',
    ]);
  });

  it('should not report offenses for route objects', async () => {
    const sourceCode = `
      <form action="{{ routes.search_url }}"></form>
      <a href="/{{ blog.url }}"></a>  
      <a href="/admin"></a>
      <a href="#MainContent"></a>
      <li>{{ 'About' | link_to: '/pages/about' }}</li>
    `;

    const offenses = await runLiquidCheck(HardcodedRoutes, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
