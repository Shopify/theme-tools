import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './no-stale-element-after-await';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('no-stale-element-after-await', rule, {
  valid: [
    {
      name: 'element looked up after await',
      code: `
        class ProductForm extends HTMLElement {
          async onSubmit() {
            const response = await fetch('/cart/add.js');
            const drawer = document.querySelector('cart-drawer');
            drawer.renderContents(await response.json());
          }
        }
      `,
    },
    {
      name: 'element checked with isConnected after await',
      code: `
        class ProductForm extends HTMLElement {
          async onSubmit() {
            const drawer = document.querySelector('cart-drawer');
            const response = await fetch('/cart/add.js');
            if (drawer?.isConnected) {
              drawer.renderContents(await response.json());
            }
          }
        }
      `,
    },
    {
      name: 'element re-queried after await before use',
      code: `
        class ProductForm extends HTMLElement {
          async onSubmit() {
            let drawer = document.querySelector('cart-drawer');
            const response = await fetch('/cart/add.js');
            drawer = document.querySelector('cart-drawer');
            drawer.renderContents(await response.json());
          }
        }
      `,
    },
    {
      name: 'this.querySelector inside element is not flagged',
      code: `
        class ProductForm extends HTMLElement {
          async onSubmit() {
            const btn = this.querySelector('button');
            await fetch('/cart/add.js');
            btn.disabled = false;
          }
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'document.querySelector used after await',
      code: `
        class ProductForm extends HTMLElement {
          async onSubmit() {
            const drawer = document.querySelector('cart-drawer');
            const response = await fetch('/cart/add.js');
            drawer.renderContents(await response.json());
          }
        }
      `,
      errors: [{ messageId: 'staleAfterAsync', data: { name: 'drawer', element: 'ProductForm' } }],
    },
    {
      name: 'document.querySelector used inside .then() callback',
      code: `
        class ProductForm extends HTMLElement {
          onSubmit() {
            const drawer = document.querySelector('cart-drawer');
            fetch('/cart/add.js').then((res) => {
              drawer.renderContents(res);
            });
          }
        }
      `,
      errors: [{ messageId: 'staleAfterAsync', data: { name: 'drawer', element: 'ProductForm' } }],
    },
    {
      name: 'document.getElementById used inside setTimeout callback',
      code: `
        class ModalOpener extends HTMLElement {
          open() {
            const modal = document.getElementById('QuickView');
            setTimeout(() => {
              modal.classList.add('open');
            }, 100);
          }
        }
      `,
      errors: [{ messageId: 'staleAfterAsync', data: { name: 'modal', element: 'ModalOpener' } }],
    },
  ],
});
