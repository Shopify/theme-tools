import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import plugin from './index';

describe('@shopify/eslint-plugin-theme', () => {
  it('exposes plugin metadata, all rules, and recommended flat config', () => {
    expect(plugin.meta.name).toBe('@shopify/eslint-plugin-theme');
    expect(plugin.meta.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(Object.keys(plugin.rules).sort()).toEqual([
      'no-stale-element-after-await',
      'no-stored-outside-element',
      'require-guarded-custom-element-define',
      'require-listener-cleanup',
      'require-page-state-cleanup',
      'require-teardown',
    ]);
    expect(plugin.configs.recommended.rules).toEqual({
      'theme/no-stale-element-after-await': 'warn',
      'theme/no-stored-outside-element': 'warn',
      'theme/require-guarded-custom-element-define': 'warn',
      'theme/require-listener-cleanup': 'warn',
      'theme/require-page-state-cleanup': 'warn',
      'theme/require-teardown': 'warn',
    });
  });

  it('works with ESLint 9 flat config and reports warnings at warn severity', () => {
    const linter = new Linter();
    const code = `
      if (!customElements.get('product-form')) {
        customElements.define(
          'product-form',
          class ProductForm extends HTMLElement {
            constructor() {
              super();
              this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
            }
          },
        );
      }
    `;

    const messages = linter.verify(code, [plugin.configs.recommended]);

    expect(messages).toHaveLength(1);
    expect(messages[0].ruleId).toBe('theme/no-stored-outside-element');
    expect(messages[0].severity).toBe(1);
    expect(messages[0].message).toContain("'this.cart'");
    expect(messages[0].message).toContain('<product-form>');
    expect(messages[0].message).toContain('get cart()');
    expect(messages[0].message).toContain('isConnected');
  });

  it('converges multiple autofixes cleanly across passes with verifyAndFix', () => {
    const linter = new Linter();
    const code = `class StickyHeader extends HTMLElement {
  connectedCallback() {
    window.addEventListener('scroll', this.onScroll, false);
    document.addEventListener('keydown', this.onKeydown, { passive: true });
    this.observer = new ResizeObserver(() => this.measure());
    this.observer.observe(this);
  }
}
customElements.define('sticky-header', StickyHeader);`;

    const result = linter.verifyAndFix(code, [plugin.configs.recommended]);

    expect(result.fixed).toBe(true);
    expect(result.messages).toHaveLength(0);
    expect(result.output).toContain("if (!customElements.get('sticky-header'))");
    expect(result.output).toContain('signal: this._abortController.signal');
    expect(result.output).toContain('this._abortController?.abort();');
    expect(result.output).toContain('this.observer?.disconnect();');
  });
});
