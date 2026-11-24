import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './require-page-state-cleanup';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('require-page-state-cleanup', rule, {
  valid: [
    {
      name: 'body class cleaned up via close() called from disconnectedCallback',
      code: `
        class CartDrawer extends HTMLElement {
          open() {
            document.body.classList.add('overflow-hidden');
          }
          close() {
            document.body.classList.remove('overflow-hidden');
          }
          disconnectedCallback() {
            this.close();
          }
        }
      `,
    },
    {
      name: 'CSS custom properties skipped by default',
      code: `
        class HeaderMenu extends HTMLElement {
          onToggle() {
            document.documentElement.style.setProperty('--header-height', '80px');
          }
        }
      `,
    },
    {
      name: 'body style restored via saved previous value in disconnectedCallback helper',
      code: `
        class CartDisclosureModal extends HTMLElement {
          lockScroll() {
            this.prevPadding = document.body.style.paddingRight;
            document.body.style.paddingRight = '15px';
          }
          unlockScroll() {
            document.body.style.paddingRight = this.prevPadding;
          }
          disconnectedCallback() {
            this.unlockScroll();
          }
        }
      `,
    },
    {
      name: 'camelCase style mutation cleaned up with kebab-case removeProperty',
      code: `
        class ModalDialog extends HTMLElement {
          open() {
            document.body.style.paddingRight = '15px';
          }
          disconnectedCallback() {
            document.body.style.removeProperty('padding-right');
          }
        }
      `,
    },
    {
      name: 'clearing style to empty string is not flagged',
      code: `
        class CartDrawer extends HTMLElement {
          close() {
            document.body.style.overflow = '';
          }
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'document.body.classList.add without disconnectedCallback cleanup',
      code: `class CartDrawer extends HTMLElement {
  open() {
    document.body.classList.add('overflow-hidden');
  }
  close() {
    document.body.classList.remove('overflow-hidden');
  }
}`,
      errors: [
        {
          messageId: 'uncleanedPageState',
          suggestions: [
            {
              messageId: 'suggestCleanup',
              output: `class CartDrawer extends HTMLElement {
  open() {
    document.body.classList.add('overflow-hidden');
  }
  close() {
    document.body.classList.remove('overflow-hidden');
  }

  disconnectedCallback() {
    document.body.classList.remove('overflow-hidden');
  }
}`,
            },
          ],
        },
      ],
    },
    {
      name: 'document.body.style.overflow assignment without cleanup',
      code: `class ModalDialog extends HTMLElement {
  open() {
    document.body.style.overflow = 'hidden';
  }
}`,
      errors: [
        {
          messageId: 'uncleanedPageState',
          suggestions: [
            {
              messageId: 'suggestCleanup',
              output: `class ModalDialog extends HTMLElement {
  open() {
    document.body.style.overflow = 'hidden';
  }

  disconnectedCallback() {
    document.body.style.overflow = '';
  }
}`,
            },
          ],
        },
      ],
    },
    {
      name: 'cleaning document.body does not satisfy mutation on document.documentElement',
      code: `class Drawer extends HTMLElement {
  open() {
    document.documentElement.classList.add('lock-all');
  }
  disconnectedCallback() {
    document.body.classList.remove('lock-all');
  }
}`,
      errors: [
        {
          messageId: 'uncleanedPageState',
          suggestions: [
            {
              messageId: 'suggestCleanup',
              output: `class Drawer extends HTMLElement {
  open() {
    document.documentElement.classList.add('lock-all');
  }
  disconnectedCallback() {
    document.body.classList.remove('lock-all');
    document.documentElement.classList.remove('lock-all');
  }
}`,
            },
          ],
        },
      ],
    },
    {
      name: 'CSS custom property flagged when checkCustomProperties is enabled',
      options: [{ checkCustomProperties: true }],
      code: `class HeaderMenu extends HTMLElement {
  onToggle() {
    document.documentElement.style.setProperty('--header-height', '80px');
  }
}`,
      errors: [
        {
          messageId: 'uncleanedPageState',
          suggestions: [
            {
              messageId: 'suggestCleanup',
              output: `class HeaderMenu extends HTMLElement {
  onToggle() {
    document.documentElement.style.setProperty('--header-height', '80px');
  }

  disconnectedCallback() {
    document.documentElement.style.removeProperty('--header-height');
  }
}`,
            },
          ],
        },
      ],
    },
  ],
});
