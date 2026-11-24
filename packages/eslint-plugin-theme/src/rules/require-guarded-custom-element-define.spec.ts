import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './require-guarded-custom-element-define';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('require-guarded-custom-element-define', rule, {
  valid: [
    {
      name: 'guarded with if (!customElements.get(...))',
      code: `
        if (!customElements.get('cart-drawer')) {
          customElements.define('cart-drawer', CartDrawer);
        }
      `,
    },
    {
      name: 'guarded with window.customElements.get',
      code: `
        if (!window.customElements.get('cart-drawer')) {
          window.customElements.define('cart-drawer', CartDrawer);
        }
      `,
    },
    {
      name: 'guarded with early return',
      code: `
        function register() {
          if (customElements.get('cart-drawer')) return;
          customElements.define('cart-drawer', CartDrawer);
        }
      `,
    },
    {
      name: 'guarded with logical OR',
      code: `customElements.get('cart-drawer') || customElements.define('cart-drawer', CartDrawer);`,
    },
    {
      name: 'guarded with try/catch',
      code: `
        try {
          customElements.define('cart-drawer', CartDrawer);
        } catch {}
      `,
    },
  ],
  invalid: [
    {
      name: 'unguarded top-level customElements.define',
      code: `customElements.define('cart-drawer', CartDrawer);`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'cart-drawer'" } }],
      output: `if (!customElements.get('cart-drawer')) {\n  customElements.define('cart-drawer', CartDrawer);\n}`,
    },
    {
      name: 'unguarded multiline inline class define',
      code: `  customElements.define(\n    'product-form',\n    class extends HTMLElement {},\n  );`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'product-form'" } }],
      output: `  if (!customElements.get('product-form')) {\n    customElements.define(\n      'product-form',\n      class extends HTMLElement {},\n    );\n  }`,
    },
    {
      name: 'wrong tag name in customElements.get guard is still flagged',
      code: `if (!customElements.get('other-el')) {\n  customElements.define('cart-drawer', CartDrawer);\n}`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'cart-drawer'" } }],
      output: `if (!customElements.get('other-el')) {\n  if (!customElements.get('cart-drawer')) {\n    customElements.define('cart-drawer', CartDrawer);\n  }\n}`,
    },
    {
      name: 'inverted polarity guard (missing !) is still flagged',
      code: `if (customElements.get('cart-drawer')) {\n  customElements.define('cart-drawer', CartDrawer);\n}`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'cart-drawer'" } }],
      output: `if (customElements.get('cart-drawer')) {\n  if (!customElements.get('cart-drawer')) {\n    customElements.define('cart-drawer', CartDrawer);\n  }\n}`,
    },
    {
      name: 'dangling else prevents unsafe autofix',
      code: `if (flag) customElements.define('cart-drawer', CartDrawer);\nelse fallback();`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'cart-drawer'" } }],
    },
    {
      name: 'multiline template literal inside define is not corrupted by autofix',
      code: `customElements.define(\n  'x-box',\n  class extends HTMLElement {\n    html() {\n      return \`line1\nline2\`;\n    }\n  },\n);`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: "'x-box'" } }],
      output: `if (!customElements.get('x-box')) {\ncustomElements.define(\n  'x-box',\n  class extends HTMLElement {\n    html() {\n      return \`line1\nline2\`;\n    }\n  },\n);\n}`,
    },
    {
      name: 'unguarded window.customElements.define with identifier tag',
      code: `window.customElements.define(TAG_NAME, MyEl);`,
      errors: [{ messageId: 'unguardedDefine', data: { tag: 'TAG_NAME' } }],
      output: `if (!window.customElements.get(TAG_NAME)) {\n  window.customElements.define(TAG_NAME, MyEl);\n}`,
    },
  ],
});
