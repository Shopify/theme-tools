# `theme/no-stale-element-after-await`

Disallow using a local variable from a document-wide DOM lookup after an `await`, `.then()`, or `setTimeout()` without checking `isConnected` or re-querying.

## Why this rule exists

If a custom element looks up an outside element before an async operation (`fetch`, `setTimeout`, etc.), that element can be replaced in the DOM while the async work is in flight. Using the saved reference after resuming silently operates on a detached element.

## Examples

### Incorrect

```js
class ProductForm extends HTMLElement {
  async onSubmit() {
    const drawer = document.querySelector('cart-drawer');
    const response = await fetch(routes.cart_add_url);
    drawer.renderContents(await response.json());
  }
}
```

### Correct

Re-query after the async boundary:

```js
class ProductForm extends HTMLElement {
  async onSubmit() {
    const response = await fetch(routes.cart_add_url);
    const drawer = document.querySelector('cart-drawer');
    drawer?.renderContents(await response.json());
  }
}
```

Or check `isConnected`:

```js
class ProductForm extends HTMLElement {
  async onSubmit() {
    const drawer = document.querySelector('cart-drawer');
    const response = await fetch(routes.cart_add_url);
    if (drawer?.isConnected) {
      drawer.renderContents(await response.json());
    }
  }
}
```
