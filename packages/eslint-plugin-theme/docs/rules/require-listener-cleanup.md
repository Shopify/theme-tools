# `theme/require-listener-cleanup`

Require cleaning up global or outside-element event listeners when a custom element disconnects.

## Why this rule exists

When a custom element registers an event listener on `window`, `document`, `document.body`, `document.documentElement`, or an outside element from a `document.*` lookup without removing it in `disconnectedCallback()`, removing or replacing the element leaks the listener. On each dynamic re-render, duplicate listeners accumulate and invoke handlers on detached elements.

Listeners attached to `this` or descendants (`this.querySelector(...)`) are not flagged because they are garbage-collected with the element itself.

## Examples

### Incorrect

```js
class StickyHeader extends HTMLElement {
  connectedCallback() {
    window.addEventListener('scroll', this.onScroll);
  }
}
```

### Correct

Using `AbortController` `{ signal }`:

```js
class StickyHeader extends HTMLElement {
  connectedCallback() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    window.addEventListener('scroll', this.onScroll, { signal: this._abortController.signal });
  }

  disconnectedCallback() {
    this._abortController?.abort();
  }
}
```

Or calling `removeEventListener` in `disconnectedCallback()` (or passing `{ once: true }`).

## Autofix

For listeners registered directly inside `connectedCallback()`, this rule autofixes by initializing an `AbortController`, passing `{ signal: this._abortController.signal }`, and calling `this._abortController?.abort()` in `disconnectedCallback()`.
