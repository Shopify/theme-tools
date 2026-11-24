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
      name: 'listener using local opts variable with signal and private #cleanup method',
      code: `
        class ThemeDrawer extends HTMLElement {
          #onMove = () => {};
          #onKeyDown = () => {};
          onDrag() {
            const ac = new AbortController();
            const opts = { signal: ac.signal };
            document.addEventListener('pointermove', this.#onMove, opts);
          }
          open() {
            document.addEventListener('keydown', this.#onKeyDown);
          }
          disconnectedCallback() {
            this.#removeListeners();
          }
          #removeListeners() {
            document.removeEventListener('keydown', this.#onKeyDown);
          }
        }
      `,
    },
    {
      name: 'local variable target cleaned up via fresh querySelector in disconnectedCallback',
      code: `
        class CartDrawer extends HTMLElement {
          connectedCallback() {
            const link = document.querySelector('#cart-icon');
            link?.addEventListener('click', this.onOpen);
          }
          disconnectedCallback() {
            document.querySelector('#cart-icon')?.removeEventListener('click', this.onOpen);
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
      name: 'bound handler cannot be removed by removeEventListener',
      code: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    window.addEventListener('scroll', this.onScroll.bind(this));
  }
  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll.bind(this));
  }
}`,
      errors: [{ messageId: 'uncleanedListener' }],
      output: `class StickyHeader extends HTMLElement {
  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    window.addEventListener('scroll', this.onScroll.bind(this), { signal: this._abortController.signal });
  }
  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll.bind(this));
    this._abortController?.abort();
  }
}`,
    },
    {
      name: 'no autofix on subclass of custom base class or self-reparenting connectedCallback',
      code: `class SubEl extends BaseEl {
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
  }
}
customElements.define('sub-el', SubEl);

class ModalDialog extends HTMLElement {
  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
    window.addEventListener('resize', this.onResize);
  }
}`,
      errors: [{ messageId: 'uncleanedListener' }, { messageId: 'uncleanedListener' }],
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
