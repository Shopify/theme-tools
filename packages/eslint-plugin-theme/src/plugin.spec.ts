import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import plugin from './index';

describe('@shopify/eslint-plugin-theme', () => {
  it('exposes plugin metadata, rules, and recommended flat config', () => {
    expect(plugin.meta.name).toBe('@shopify/eslint-plugin-theme');
    expect(plugin.meta.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(plugin.rules['no-stored-outside-element']).toBeDefined();
    expect(plugin.configs.recommended).toBeDefined();
    expect(plugin.configs.recommended.rules).toEqual({
      'theme/no-stored-outside-element': 'warn',
    });
  });

  it('works with ESLint 9 flat config and reports warnings at warn severity', () => {
    const linter = new Linter();
    const code = `
      customElements.define(
        'product-form',
        class ProductForm extends HTMLElement {
          constructor() {
            super();
            this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
          }
        },
      );
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
});
