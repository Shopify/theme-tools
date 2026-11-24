import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './no-stored-outside-element';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

ruleTester.run('no-stored-outside-element', rule, {
  valid: [
    // Inside-element lookups
    {
      name: 'this.querySelector inside custom element',
      code: `
        class ProductForm extends HTMLElement {
          constructor() {
            super();
            this.form = this.querySelector('form');
            this.inputs = this.querySelectorAll('input');
            this.shadowEl = this.shadowRoot?.querySelector('.inner');
          }
        }
      `,
    },
    // Plain getter doing lookup each time
    {
      name: 'getter that performs the lookup on each access',
      code: `
        customElements.define(
          'product-form',
          class extends HTMLElement {
            get cart() {
              return document.querySelector('cart-notification') || document.querySelector('cart-drawer');
            }
          },
        );
      `,
    },
    // Cached lookup guarded by isConnected (optional chaining)
    {
      name: 'cached getter checking isConnected with optional chaining',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            if (!this._cart?.isConnected) {
              this._cart =
                document.querySelector('cart-notification') || document.querySelector('cart-drawer');
            }
            return this._cart;
          }
        }
      `,
    },
    // Cached lookup guarded by explicit null + isConnected check
    {
      name: 'cached getter checking null and isConnected',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            if (!this._cart || !this._cart.isConnected) {
              this._cart = document.querySelector('cart-drawer');
            }
            return this._cart;
          }
        }
      `,
    },
    // Cached lookup with early return when connected
    {
      name: 'cached getter with early return on isConnected',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            if (this._cart?.isConnected) return this._cart;
            this._cart = document.querySelector('cart-drawer');
            return this._cart;
          }
        }
      `,
    },
    // Cached lookup with ternary on isConnected
    {
      name: 'cached lookup using ternary with isConnected',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            this._cart = this._cart?.isConnected
              ? this._cart
              : document.querySelector('cart-drawer');
            return this._cart;
          }
        }
      `,
    },
    // Cached lookup in else branch of isConnected check
    {
      name: 'cached lookup in else branch of isConnected check',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            if (this._cart?.isConnected) {
              return this._cart;
            } else {
              this._cart = document.querySelector('cart-drawer');
            }
            return this._cart;
          }
        }
      `,
    },
    // Cached lookup using document.contains
    {
      name: 'cached lookup checking document.contains',
      code: `
        class ProductForm extends HTMLElement {
          get cart() {
            if (!document.contains(this._cart)) {
              this._cart = document.querySelector('cart-drawer');
            }
            return this._cart;
          }
        }
      `,
    },
    {
      name: 'Array.from with mapFn and computed property on single element are not flagged',
      code: `
        class ProductForm extends HTMLElement {
          constructor() {
            super();
            this.ids = Array.from(document.querySelectorAll('.item'), (el) => el.dataset.id);
            const prop = 'id';
            this.singleProp = document.getElementById('cart')[prop];
          }
        }
      `,
    },
    // Live HTMLCollection / NodeList stored directly updates automatically
    {
      name: 'live collections (getElementsBy*) stored directly are not flagged',
      code: `
        class CardList extends HTMLElement {
          constructor() {
            super();
            this.cards = document.getElementsByClassName('card');
            this.sections = document.getElementsByTagName('section');
            this.named = document.getElementsByName('id');
          }
        }
      `,
    },
    // Non-HTMLElement class
    {
      name: 'plain class not extending HTMLElement',
      code: `
        class CartController {
          constructor() {
            this.cart = document.querySelector('cart-drawer');
          }
        }
      `,
    },
    // Class extending a non-HTMLElement class in the same file
    {
      name: 'subclass of plain class',
      code: `
        class BaseController {}
        class CartController extends BaseController {
          constructor() {
            super();
            this.cart = document.querySelector('cart-drawer');
          }
        }
      `,
    },
    // Regular (non-arrow) function inside a custom element method has its own `this`
    {
      name: 'regular function inside custom element method',
      code: `
        class ProductForm extends HTMLElement {
          connectedCallback() {
            function Helper() {
              this.cart = document.querySelector('cart-drawer');
            }
            const fn = function () {
              this.cart = document.querySelector('cart-drawer');
            };
            return [Helper, fn];
          }
        }
      `,
    },
    // Static methods and fields do not bind instance `this`
    {
      name: 'static method and static field on custom element',
      code: `
        class ProductForm extends HTMLElement {
          static defaultCart = document.querySelector('cart-drawer');
          static init() {
            this.cart = document.querySelector('cart-drawer');
          }
        }
      `,
    },
    // Nested non-HTMLElement class inside a custom element
    {
      name: 'nested non-HTMLElement class',
      code: `
        class ProductForm extends HTMLElement {
          createHelper() {
            return class Helper {
              constructor() {
                this.cart = document.querySelector('cart-drawer');
              }
            };
          }
        }
      `,
    },
    // Re-lookup through a helper method inside an event handler
    {
      name: 're-lookup through helper method in submit handler',
      code: `
        class ProductForm extends HTMLElement {
          getCartComponent() {
            return document.querySelector('cart-drawer');
          }
          onSubmitHandler() {
            this.cart = this.getCartComponent();
          }
        }
      `,
    },
    // Storing primitive/property values read from a lookup rather than the element itself
    {
      name: 'storing property or boolean derived from lookup',
      code: `
        class ProductForm extends HTMLElement {
          constructor() {
            super();
            this.headerHeight = document.querySelector('header')?.offsetHeight;
            this.hasCart = Boolean(document.querySelector('cart-drawer'));
            this.hasDrawer = !!document.querySelector('cart-drawer');
            this.sectionId = this.closest('.shopify-section')?.dataset.id;
          }
        }
      `,
    },
    // this.closest is opt-in and ignored by default
    {
      name: 'this.closest ignored by default',
      code: `
        class QuickOrderList extends HTMLElement {
          constructor() {
            super();
            this.modal = this.closest('bulk-modal');
          }
        }
      `,
    },
    // this.closest reading a property is still valid when checkClosest is true
    {
      name: 'this.closest reading a non-element property with checkClosest enabled',
      options: [{ checkClosest: true }],
      code: `
        class QuickAddBulk extends HTMLElement {
          get sectionId() {
            if (!this._sectionId) {
              this._sectionId = this.closest('.collection-quick-add-bulk').dataset.id;
            }
            return this._sectionId;
          }
        }
      `,
    },
    // this.closest guarded by isConnected with checkClosest enabled
    {
      name: 'this.closest guarded by isConnected with checkClosest enabled',
      options: [{ checkClosest: true }],
      code: `
        class QuickOrderList extends HTMLElement {
          get modal() {
            if (!this._modal?.isConnected) {
              this._modal = this.closest('bulk-modal');
            }
            return this._modal;
          }
        }
      `,
    },
  ],

  invalid: [
    // Dawn product-form.js exact pattern (named class expression inside customElements.define)
    {
      name: 'Dawn product-form.js pattern with || and suggestion',
      code: `if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.form = this.querySelector('form');
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      }
    }
  );
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.cart',
            element: '<product-form>',
            getterName: 'cart',
          },
          line: 8,
          column: 9,
          endColumn: 18,
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.cart' },
              output: `if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.form = this.querySelector('form');
      }

      get cart() {
        return document.querySelector('cart-notification') || document.querySelector('cart-drawer');
      }
    }
  );
}`,
            },
          ],
        },
      ],
    },
    // Anonymous class inside customElements.define
    {
      name: 'anonymous class inside customElements.define',
      code: `customElements.define(
  'product-form',
  class extends HTMLElement {
    constructor() {
      super();
      this.cart = document.querySelector('cart-drawer');
    }
  },
);`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.cart',
            element: '<product-form>',
            getterName: 'cart',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.cart' },
              output: `customElements.define(
  'product-form',
  class extends HTMLElement {
    constructor() {
      super();
    }

    get cart() {
      return document.querySelector('cart-drawer');
    }
  },
);`,
            },
          ],
        },
      ],
    },
    // Separate class declaration registered later via customElements.define
    {
      name: 'class declaration registered via customElements.define',
      code: `class CartNotification extends HTMLElement {
  constructor() {
    super();
    this.notification = document.getElementById('cart-notification');
  }
}
customElements.define('cart-notification', CartNotification);`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.notification',
            element: '<cart-notification>',
            getterName: 'notification',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.notification' },
              output: `class CartNotification extends HTMLElement {
  constructor() {
    super();
  }

  get notification() {
    return document.getElementById('cart-notification');
  }
}
customElements.define('cart-notification', CartNotification);`,
            },
          ],
        },
      ],
    },
    // Fallback to class name when no customElements.define in file
    {
      name: 'fallback to class name when not registered in file',
      code: `class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.cart = document.querySelector('cart-drawer');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.cart',
            element: 'ProductForm',
            getterName: 'cart',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.cart' },
              output: `class ProductForm extends HTMLElement {
  constructor() {
    super();
  }

  get cart() {
    return document.querySelector('cart-drawer');
  }
}`,
            },
          ],
        },
      ],
    },
    // Fallback to 'this element' for anonymous class without customElements.define
    {
      name: 'fallback to this element for anonymous class',
      code: `export default class extends HTMLElement {
  constructor() {
    super();
    this.cart = document.querySelector('cart-drawer');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.cart',
            element: 'this element',
            getterName: 'cart',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.cart' },
              output: `export default class extends HTMLElement {
  constructor() {
    super();
  }

  get cart() {
    return document.querySelector('cart-drawer');
  }
}`,
            },
          ],
        },
      ],
    },
    // Same-file multi-level inheritance
    {
      name: 'multi-level same-file inheritance from HTMLElement',
      code: `class BaseEl extends HTMLElement {}
class MidEl extends BaseEl {}
class HeaderMenu extends MidEl {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
  }
}
customElements.define('header-menu', HeaderMenu);`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.header',
            element: '<header-menu>',
            getterName: 'header',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.header' },
              output: `class BaseEl extends HTMLElement {}
class MidEl extends BaseEl {}
class HeaderMenu extends MidEl {
  constructor() {
    super();
  }

  get header() {
    return document.querySelector('.header-wrapper');
  }
}
customElements.define('header-menu', HeaderMenu);`,
            },
          ],
        },
      ],
    },
    // Cross-file base class recognized via customElements.define
    {
      name: 'cross-file base class registered via customElements.define',
      code: `class PredictiveSearch extends SearchForm {
  constructor() {
    super();
    this.allInstances = document.querySelectorAll('predictive-search');
  }
}
customElements.define('predictive-search', PredictiveSearch);`,
      errors: [
        {
          messageId: 'storedOutsideList',
          data: {
            target: 'this.allInstances',
            element: '<predictive-search>',
            getterName: 'allInstances',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.allInstances' },
              output: `class PredictiveSearch extends SearchForm {
  constructor() {
    super();
  }

  get allInstances() {
    return document.querySelectorAll('predictive-search');
  }
}
customElements.define('predictive-search', PredictiveSearch);`,
            },
          ],
        },
      ],
    },
    // Mixin base class wrapping HTMLElement
    {
      name: 'mixin base class wrapping HTMLElement',
      code: `class CartItems extends withMixin(HTMLElement) {
  constructor() {
    super();
    this.status = document.getElementById('cart-status');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.status',
            element: 'CartItems',
            getterName: 'status',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.status' },
              output: `class CartItems extends withMixin(HTMLElement) {
  constructor() {
    super();
  }

  get status() {
    return document.getElementById('cart-status');
  }
}`,
            },
          ],
        },
      ],
    },
    // Built-in element subclass & window.HTMLElement
    {
      name: 'built-in HTMLButtonElement subclass',
      code: `class CartButton extends HTMLButtonElement {
  constructor() {
    super();
    this.drawer = document.querySelector('cart-drawer');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: {
            target: 'this.drawer',
            element: 'CartButton',
            getterName: 'drawer',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.drawer' },
              output: `class CartButton extends HTMLButtonElement {
  constructor() {
    super();
  }

  get drawer() {
    return document.querySelector('cart-drawer');
  }
}`,
            },
          ],
        },
      ],
    },
    // Lookup variants: ??, ternary, optional chaining, spread/Array.from snapshot, indexed live collection
    {
      name: 'lookup expression variants (??, ternary, optional chaining, snapshots, indexed live collections)',
      code: `class MyWidget extends HTMLElement {
  setup() {
    this.a = document.querySelector('a') ?? document.querySelector('b');
    this.b = this.useDrawer ? document.querySelector('cart-drawer') : this.querySelector('.local');
    this.c = document.querySelector('header')?.querySelector('.nav');
    this.d = [...document.getElementsByClassName('card')];
    this.e = Array.from(document.getElementsByTagName('section'));
    this.f = document.getElementsByClassName('card')[0];
    this.g = [...document.querySelectorAll('cart-item')];
    this.h = Array.from(document.querySelectorAll('cart-item'));
    this.i = document.querySelectorAll('.pswp')[0];
    this.j = window.document.body.querySelector('.modal');
    this.k = this.hasDrawer && document.querySelector('cart-drawer');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.a', element: 'MyWidget', getterName: 'a' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.b', element: 'MyWidget', getterName: 'b' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.c', element: 'MyWidget', getterName: 'c' },
        },
        {
          messageId: 'storedOutsideList',
          data: { target: 'this.d', element: 'MyWidget', getterName: 'd' },
        },
        {
          messageId: 'storedOutsideList',
          data: { target: 'this.e', element: 'MyWidget', getterName: 'e' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.f', element: 'MyWidget', getterName: 'f' },
        },
        {
          messageId: 'storedOutsideList',
          data: { target: 'this.g', element: 'MyWidget', getterName: 'g' },
        },
        {
          messageId: 'storedOutsideList',
          data: { target: 'this.h', element: 'MyWidget', getterName: 'h' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.i', element: 'MyWidget', getterName: 'i' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.j', element: 'MyWidget', getterName: 'j' },
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.k', element: 'MyWidget', getterName: 'k' },
        },
      ],
    },
    // Static snapshot list cannot rely on isConnected caching (misses newly added elements)
    {
      name: 'querySelectorAll snapshot with isConnected guard is still flagged',
      code: `class SearchBar extends HTMLElement {
  get inputs() {
    if (!this._inputs?.[0]?.isConnected) {
      this._inputs = document.querySelectorAll('input[type="search"]');
    }
    return this._inputs;
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideList',
          data: { target: 'this._inputs', element: 'SearchBar', getterName: '_inputs' },
          suggestions: [],
        },
      ],
    },
    // Lazy cache WITHOUT isConnected check (flagged, no suggestion)
    {
      name: 'lazy cache without isConnected check',
      code: `class HeaderDrawer extends HTMLElement {
  open() {
    this.header = this.header || document.querySelector('.section-header');
    this.nav ||= document.querySelector('.site-nav');
    this.footer ??= document.querySelector('footer');
  }
  get cart() {
    if (!this._cart) {
      this._cart = document.querySelector('cart-drawer');
    }
    return this._cart;
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.header', element: 'HeaderDrawer', getterName: 'header' },
          suggestions: [],
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.nav', element: 'HeaderDrawer', getterName: 'nav' },
          suggestions: [],
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.footer', element: 'HeaderDrawer', getterName: 'footer' },
          suggestions: [],
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this._cart', element: 'HeaderDrawer', getterName: '_cart' },
          suggestions: [],
        },
      ],
    },
    // Checking isConnected on the wrong field still flags
    {
      name: 'isConnected check on unrelated field still flags',
      code: `class ProductForm extends HTMLElement {
  get cart() {
    if (!this._other?.isConnected) {
      this._cart = document.querySelector('cart-drawer');
    }
    return this._cart;
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this._cart', element: 'ProductForm', getterName: '_cart' },
          suggestions: [],
        },
      ],
    },
    // Class field initializer & private field
    {
      name: 'class field and private field initializers',
      code: `class ProductForm extends HTMLElement {
  cart = document.querySelector('cart-drawer');
  #header = document.querySelector('sticky-header');
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.cart', element: 'ProductForm', getterName: 'cart' },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.cart' },
              output: `class ProductForm extends HTMLElement {
  get cart() {
    return document.querySelector('cart-drawer');
  }
  #header = document.querySelector('sticky-header');
}`,
            },
          ],
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.#header', element: 'ProductForm', getterName: '#header' },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.#header' },
              output: `class ProductForm extends HTMLElement {
  cart = document.querySelector('cart-drawer');
  get #header() {
    return document.querySelector('sticky-header');
  }
}`,
            },
          ],
        },
      ],
    },
    // connectedCallback assignment offers suggestion when safe
    {
      name: 'connectedCallback assignment with safe getter suggestion',
      code: `class HeaderMenu extends HTMLElement {
  connectedCallback() {
    this.header = document.querySelector('.header-wrapper');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.header', element: 'HeaderMenu', getterName: 'header' },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.header' },
              output: `class HeaderMenu extends HTMLElement {
  connectedCallback() {
  }

  get header() {
    return document.querySelector('.header-wrapper');
  }
}`,
            },
          ],
        },
      ],
    },
    // No suggestion when constructor assignment references a local variable or is reassigned later
    {
      name: 'no suggestion when RHS uses local variable or field is reassigned',
      code: `class ProductForm extends HTMLElement {
  constructor() {
    super();
    const selector = 'cart-drawer';
    this.cart = document.querySelector(selector);
    this.header = document.querySelector('sticky-header');
  }
  reset() {
    this.header = null;
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.cart', element: 'ProductForm', getterName: 'cart' },
          suggestions: [],
        },
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.header', element: 'ProductForm', getterName: 'header' },
          suggestions: [],
        },
      ],
    },
    // Arrow function callback inside custom element preserves `this`
    {
      name: 'assignment inside arrow function callback',
      code: `class ProductForm extends HTMLElement {
  load() {
    Promise.resolve().then(() => {
      this.cart = document.querySelector('cart-drawer');
    });
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.cart', element: 'ProductForm', getterName: 'cart' },
          suggestions: [],
        },
      ],
    },
    // Private field assigned in constructor
    {
      name: 'private field assigned in constructor',
      code: `class ProductForm extends HTMLElement {
  #cart;
  constructor() {
    super();
    this.#cart = document.querySelector('cart-drawer');
  }
}`,
      errors: [
        {
          messageId: 'storedOutsideElement',
          data: { target: 'this.#cart', element: 'ProductForm', getterName: '#cart' },
          // Existing `#cart;` field declaration prevents safe getter suggestion
          suggestions: [],
        },
      ],
    },
    // Inverted isConnected polarity is still flagged
    {
      name: 'inverted isConnected guard is still flagged',
      code: `class ProductForm extends HTMLElement {
  get cart() {
    if (this._cart?.isConnected) {
      this._cart = document.querySelector('cart-drawer');
    }
    return this._cart;
  }
}`,
      errors: [{ messageId: 'storedOutsideElement', suggestions: [] }],
    },
    // No suggestion when early return precedes assignment or destructuring reassigns field
    {
      name: 'no suggestion when connectedCallback has early return or destructuring reassigns',
      code: `class ProductForm extends HTMLElement {
  connectedCallback() {
    if (!this.enabled) return;
    this.cart = document.querySelector('cart-drawer');
  }
  reset() {
    [this.header] = [null];
  }
  constructor() {
    super();
    this.header = document.querySelector('sticky-header');
  }
}`,
      errors: [
        { messageId: 'storedOutsideElement', suggestions: [] },
        { messageId: 'storedOutsideElement', suggestions: [] },
      ],
    },
    // checkClosest: true option
    {
      name: 'this.closest flagged when checkClosest is enabled',
      options: [{ checkClosest: true }],
      code: `customElements.define(
  'quick-order-list',
  class QuickOrderList extends HTMLElement {
    constructor() {
      super();
      this.modal = this.closest('bulk-modal');
    }
  },
);`,
      errors: [
        {
          messageId: 'storedAncestorElement',
          data: {
            target: 'this.modal',
            element: '<quick-order-list>',
            getterName: 'modal',
          },
          suggestions: [
            {
              messageId: 'replaceWithGetter',
              data: { target: 'this.modal' },
              output: `customElements.define(
  'quick-order-list',
  class QuickOrderList extends HTMLElement {
    constructor() {
      super();
    }

    get modal() {
      return this.closest('bulk-modal');
    }
  },
);`,
            },
          ],
        },
      ],
    },
  ],
});
