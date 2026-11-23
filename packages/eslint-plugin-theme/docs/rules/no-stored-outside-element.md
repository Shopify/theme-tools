# `theme/no-stored-outside-element`

Disallow storing the result of document-wide DOM lookups on custom element instances.

## Why this rule exists

In the Shopify theme editor, parts of the page are redrawn while the rest stays: a section is re-rendered, or a custom element is replaced by a fresh instance. If a custom element looked up an element outside itself once (for example in `constructor()`) and saved a reference on `this`, it continues to hold the old, detached element. Nothing throws; the feature silently stops working until a full page reload.

For example, in a product form that caches a reference to `<cart-drawer>` on construction:

```js
customElements.define(
  'product-form',
  class ProductForm extends HTMLElement {
    constructor() {
      super();
      // Looked up once when <product-form> is created
      this.cart =
        document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    }

    onSubmitHandler(evt) {
      // ...
      fetch(`${routes.cart_add_url}`, config)
        .then((response) => response.json())
        .then((response) => {
          // If <cart-drawer> was replaced, this updates a detached element
          this.cart.renderContents(response);
        });
    }
  },
);
```

When `<cart-drawer>` is replaced, `this.cart` still points at the detached element. The request succeeds, `renderContents` runs on the old drawer, and nothing opens on screen.

## Rule details

### Scope

This rule only checks classes recognized as custom elements in the current file:

- Classes extending `HTMLElement` (or another built-in element class such as `HTMLButtonElement`, or a mixin call wrapping one, such as `createViewEventElement(HTMLElement)`).
- Classes extending another class in the same file that extends `HTMLElement` (to any inheritance depth within the file).
- Classes registered via `customElements.define('tag-name', ...)` in the same file (even when their superclass is imported from another file), and same-file subclasses of those classes.

Plain classes, static methods/fields, and nested non-arrow functions are ignored.

### What is flagged

Inside a custom element class, any assignment to `this.<field>` (`=`, `||=`, `??=`) or non-static class field initializer whose value comes from a document-wide lookup:

- `document.querySelector(...)`
- `document.querySelectorAll(...)`
- `document.getElementById(...)`
- `document.getElementsByClassName(...)`, `document.getElementsByTagName(...)`, `document.getElementsByTagNameNS(...)`, `document.getElementsByName(...)`
- Lookups rooted on `document.body`, `document.documentElement`, or `document.head`
- Any of the above combined with `||`, `??`, `&&`, a ternary (`? :`), optional chaining (`?.`), chained `.querySelector(...)` / `.closest(...)`, `[...querySelectorAll(...)]`, `Array.from(...)`, or collection indexing (`[0]`, `.item(0)`)

Direct assignments inside methods (not just `constructor()`) are also flagged: storing an outside element on `this` risks stale reads across async boundaries or from other methods. If you look an element up inside an event handler, use a local `const` or a getter instead.

### What is not flagged

- Lookups scoped to the element itself (`this.querySelector(...)`, `this.querySelectorAll(...)`, `this.shadowRoot.querySelector(...)`).
- A getter that performs the lookup on each access.
- A cached lookup guarded by an `isConnected` check (or `document.contains(...)`) on the same field before assigning.
- Calling a helper method such as `this.cart = this.getCartComponent()` (the rule does not trace across method calls).
- Storing a non-element value derived from a lookup, such as `this.headerHeight = document.querySelector('header')?.offsetHeight` or `this.hasCart = Boolean(document.querySelector('cart-drawer'))`.
- `this.closest(...)` by default (see [Options](#options)).

### Examples

#### Incorrect

```js
customElements.define(
  'product-form',
  class ProductForm extends HTMLElement {
    constructor() {
      super();
      this.cart =
        document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    }
  },
);
```

```js
class HeaderDrawer extends HTMLElement {
  open() {
    // Cached without checking isConnected
    this.header = this.header || document.querySelector('.section-header');
  }
}
```

#### Correct

Look up the element when you use it via a getter:

```js
customElements.define(
  'product-form',
  class ProductForm extends HTMLElement {
    get cart() {
      return document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    }
  },
);
```

For hot paths that run every frame (such as `scroll`, `pointermove`, or `requestAnimationFrame`), cache the lookup and verify `isConnected` before reusing it:

```js
class StickyBar extends HTMLElement {
  get header() {
    if (!this._header?.isConnected) {
      this._header = document.querySelector('sticky-header');
    }
    return this._header;
  }
}
```

If the target element is actually inside this custom element, scope the lookup to `this`:

```js
class CartNotification extends HTMLElement {
  constructor() {
    super();
    this.notification = this.querySelector('#cart-notification');
  }
}
```

## Suggestions

For straightforward assignments at the top level of `constructor()` or `connectedCallback()`, or non-static class field initializers, the rule offers an ESLint suggestion to replace the assignment with a getter. The suggestion is omitted when the rewrite is not guaranteed to be safe (for example, when the field is reassigned elsewhere in the class, already has a conflicting class member, or references variables local to the method).

## Options

This rule accepts an optional object:

```js
{
  'theme/no-stored-outside-element': ['warn', { checkClosest: false }]
}
```

### `checkClosest`

- Type: `boolean`
- Default: `false`

When `true`, also flags storing the result of `this.closest(...)` on `this`. This is opt-in because an ancestor normally gets replaced together with its descendants, so storing `this.closest(...)` is only stale if the custom element is reparented out of that ancestor.

## Severity

In `theme.configs.recommended`, this rule defaults to `warn`. Because static analysis cannot always tell whether a `document.getElementById(...)` or `document.querySelector(...)` call targets an element inside or outside the custom element, the diagnostic uses "may be" and explains both fixes.
