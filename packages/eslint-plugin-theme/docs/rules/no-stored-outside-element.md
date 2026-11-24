# `theme/no-stored-outside-element`

Disallow storing the result of document-wide DOM lookups on custom element instances.

## Why this rule exists

In Shopify themes, sections and custom elements can be re-rendered or replaced dynamically (for example via the Section Rendering API or in the theme editor) while other custom elements remain mounted on the page. If a custom element looked up an element outside itself once and saved a reference on `this`, it continues to hold the old, detached element. Nothing throws; the feature silently stops working until a full page reload.

## Rule details

### Scope

This rule only checks classes recognized as custom elements in the current file:

- Classes extending `HTMLElement` (or another built-in element class such as `HTMLButtonElement`, or a mixin call wrapping one, such as `withMixin(HTMLElement)`).
- Classes extending another class in the same file that extends `HTMLElement` (to any inheritance depth within the file).
- Classes registered via `customElements.define('tag-name', ...)` in the same file (even when their superclass is imported from another file), and same-file subclasses of those classes.

### Lookup categories

- **Single-element lookups** (`document.querySelector`, `document.getElementById`, indexed `querySelectorAll(...)[0]`, lookups rooted on `document.body`/`document.documentElement`/`document.head`): flagged when stored on `this`. Caching is allowed when guarded by an `isConnected` or `document.contains(...)` check on the same field (for hot paths like `scroll` or `pointermove`).
- **Static snapshot lists** (`document.querySelectorAll`, `[...document.getElementsBy*(...)]`, `Array.from(...)`): flagged when stored on `this`. Checking `isConnected` on a cached snapshot is **not** accepted, because it misses newly added elements even while existing ones stay connected.
- **Live collections** (`document.getElementsByClassName`, `document.getElementsByTagName`, `document.getElementsByTagNameNS`, `document.getElementsByName` stored directly without indexing or converting to an array): **not** flagged, because the browser keeps live collections up to date automatically.

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

#### Correct

Look up outside elements on demand via a getter:

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

For per-frame hot paths (`scroll`, `pointermove`), cache single-element lookups and verify `isConnected`:

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

If the target element lives inside this custom element, use `this.querySelector(...)` instead.

## Options

```js
{
  'theme/no-stored-outside-element': ['warn', { checkClosest: false }]
}
```

- `checkClosest` (boolean, default `false`): also flag storing `this.closest(...)` on `this`.
