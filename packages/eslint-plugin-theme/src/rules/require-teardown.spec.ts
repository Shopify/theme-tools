import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './require-teardown';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
});

ruleTester.run('require-teardown', rule, {
  valid: [
    {
      name: 'observer disconnected in disconnectedCallback',
      code: `
        class MyEl extends HTMLElement {
          connectedCallback() {
            this.observer = new ResizeObserver(this.onResize);
            this.observer.observe(this);
          }
          disconnectedCallback() {
            this.observer?.disconnect();
          }
        }
      `,
    },
    {
      name: 'one-shot IntersectionObserver observing this and unobserving in callback',
      code: `
        class LazyVideo extends HTMLElement {
          connectedCallback() {
            new IntersectionObserver((entries, observer) => {
              if (!entries[0].isIntersecting) return;
              observer.unobserve(this);
              this.load();
            }).observe(this);
          }
        }
      `,
    },
    {
      name: 'setInterval cleared via helper called from disconnectedCallback',
      code: `
        class Slideshow extends HTMLElement {
          start() {
            this.timer = setInterval(() => this.next(), 3000);
          }
          disconnectedCallback() {
            this.stop();
          }
          stop() {
            clearInterval(this.timer);
          }
        }
      `,
    },
    {
      name: 'observer unobserves in disconnectedCallback',
      code: `
        class MyEl extends HTMLElement {
          connectedCallback() {
            this.observer = new ResizeObserver(this.onResize);
            this.observer.observe(this);
          }
          disconnectedCallback() {
            this.observer?.unobserve(this);
          }
        }
      `,
    },
    {
      name: 'subscribe unsubscriber called in disconnectedCallback',
      code: `
        class CartItems extends HTMLElement {
          connectedCallback() {
            this.unsub = subscribe('cart-update', this.onUpdate);
          }
          disconnectedCallback() {
            this.unsub?.();
          }
        }
      `,
    },
  ],
  invalid: [
    {
      name: 'ResizeObserver stored on this autofixed with disconnect in disconnectedCallback',
      code: `class ResponsiveBar extends HTMLElement {
  connectedCallback() {
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(this);
  }
}`,
      errors: [{ messageId: 'uncleanedObserver' }],
      output: `class ResponsiveBar extends HTMLElement {
  connectedCallback() {
    this.resizeObserver = new ResizeObserver(() => this.update());
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
  }
}`,
    },
    {
      name: 'setInterval stored on this autofixed with clearInterval in existing disconnectedCallback',
      code: `class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.interval = setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    this.cleanup();
  }
}`,
      errors: [{ messageId: 'uncleanedInterval' }],
      output: `class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.interval = setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    this.cleanup();
    clearInterval(this.interval);
  }
}`,
    },
    {
      name: 'single-line disconnectedCallback without trailing semicolon inserts semicolon safely',
      code: `class Mini extends HTMLElement {
  connectedCallback() { this.timer = setInterval(this.tick, 1000) }
  disconnectedCallback() { this.done = true }
}`,
      errors: [{ messageId: 'uncleanedInterval' }],
      output: `class Mini extends HTMLElement {
  connectedCallback() { this.timer = setInterval(this.tick, 1000) }
  disconnectedCallback() { this.done = true; clearInterval(this.timer); }
}`,
    },
    {
      name: 'subscribe() stored on this offers suggestion',
      code: `class PricePerItem extends HTMLElement {
  connectedCallback() {
    this.cartUnsub = subscribe('cart-update', this.onUpdate);
  }
}`,
      errors: [
        {
          messageId: 'uncleanedSubscription',
          suggestions: [
            {
              messageId: 'suggestUnsubscribe',
              output: `class PricePerItem extends HTMLElement {
  connectedCallback() {
    this.cartUnsub = subscribe('cart-update', this.onUpdate);
  }

  disconnectedCallback() {
    this.cartUnsub?.();
  }
}`,
            },
          ],
        },
      ],
    },
  ],
});
