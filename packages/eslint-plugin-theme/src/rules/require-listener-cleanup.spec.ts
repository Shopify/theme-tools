import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './require-listener-cleanup';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('require-listener-cleanup', rule, {
  valid: [
    {
      name: 'listener on this itself does not need cleanup',
      code: `
        class MyEl extends HTMLElement {
          connectedCallback() {
            this.addEventListener('click', this.onClick);
            this.querySelector('button').addEventListener('click', this.onClick);
          }
        }
      `,
    },
    {
      name: 'window listener cleaned up in disconnectedCallback',
      code: `
        class StickyHeader extends HTMLElement {
          connectedCallback() {
            window.addEventListener('scroll', this.onScroll);
          }
          disconnectedCallback() {
            window.removeEventListener('scroll', this.onScroll);
          }
        }
      `,
    },
    {
      name: 'window listener cleaned up via helper called from disconnectedCallback',
      code: `
        class StickyHeader extends HTMLElement {
          connectedCallback() {
            window.addEventListener('scroll', this.onScroll);
          }
          disconnectedCallback() {
            this.unbind();
          }
          unbind() {
            window.removeEventListener('scroll', this.onScroll);
          }
        }
      `,
    },
    {
      name: 'listener using once: true or signal',
      code: `
        class MyModal extends HTMLElement {
          connectedCallback() {
            this._ac = new AbortController();
            window.addEventListener('resize', this.onResize, { signal: this._ac.signal });
            document.body.addEventListener('modalClosed', this.onClose, { once: true });
          }
          disconnectedCallback() {
            this._ac.abort();
          }
        }
      `,
    },
    {
      name: 'non-HTMLElement class ignored',
      code: `
        class PlainController {
          init() {
            window.addEventListener('resize', () => {});
          }
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'single window listener in connectedCallback autofixed with AbortController',
      code: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    window.addEventListener('scroll', this.onScroll);
  }
}`,
      errors: [{ messageId: 'uncleanedListener' }],
      output: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    window.addEventListener('scroll', this.onScroll, { signal: this._abortController.signal });
  }

  disconnectedCallback() {
    this._abortController?.abort();
  }
}`,
    },
    {
      name: 'second listener in connectedCallback when AbortController already initialized',
      code: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    window.addEventListener('scroll', this.onScroll, { signal: this._abortController.signal });
    document.addEventListener('keydown', this.onKeydown, { passive: true });
  }

  disconnectedCallback() {
    this.cleanup();
    this._abortController?.abort();
  }
}`,
      errors: [{ messageId: 'uncleanedListener' }],
      output: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    window.addEventListener('scroll', this.onScroll, { signal: this._abortController.signal });
    document.addEventListener('keydown', this.onKeydown, { passive: true, signal: this._abortController.signal });
  }

  disconnectedCallback() {
    this.cleanup();
    this._abortController?.abort();
  }
}`,
    },
    {
      name: 'listener on document.querySelector node in constructor (flagged, no autofix)',
      code: `class CartDrawer extends HTMLElement {
  constructor() {
    super();
    const cartLink = document.querySelector('#cart-icon-bubble');
    cartLink.addEventListener('click', (e) => this.open(e));
  }
}`,
      errors: [{ messageId: 'uncleanedListener' }],
    },
  ],
});
