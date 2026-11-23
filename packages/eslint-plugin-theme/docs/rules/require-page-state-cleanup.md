# `theme/require-page-state-cleanup`

Require cleaning up `document.body` and `document.documentElement` mutations in `disconnectedCallback()`.

## Why this rule exists

Drawers, modals, and overlays often lock page scroll or add state classes to `document.body` (such as `document.body.classList.add('overflow-hidden')`). If the custom element is removed or replaced while open, `close()` never runs and the page remains stuck until a full reload.

## Examples

### Incorrect

```js
class CartDrawer extends HTMLElement {
  open() {
    document.body.classList.add('overflow-hidden');
  }
  close() {
    document.body.classList.remove('overflow-hidden');
  }
}
```

### Correct

```js
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
```

## Options

```js
{
  'theme/require-page-state-cleanup': ['warn', { checkCustomProperties: false }]
}
```

- `checkCustomProperties` (boolean, default `false`): also flag `style.setProperty('--...', ...)` CSS custom properties on `document.documentElement` / `document.body`.
