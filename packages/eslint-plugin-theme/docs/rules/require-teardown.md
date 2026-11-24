# `theme/require-teardown`

Require disconnecting observers, clearing intervals, and unsubscribing in `disconnectedCallback()`.

## Why this rule exists

`MutationObserver`, `IntersectionObserver`, `ResizeObserver`, `setInterval`, and pub/sub `subscribe(...)` calls continue running after a custom element is removed from the DOM unless explicitly torn down in `disconnectedCallback()`.

One-shot `IntersectionObserver` instances that only observe `this` and call `disconnect()` or `unobserve()` inside their own callback are ignored.

## Examples

### Incorrect

```js
class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.interval = setInterval(() => this.tick(), 1000);
  }
}
```

### Correct

```js
class CountdownTimer extends HTMLElement {
  connectedCallback() {
    this.interval = setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this.interval);
  }
}
```

## Autofix

- Observers and intervals stored on `this.<field>` inside `connectedCallback()` (or a method called from it) are autofixed by appending `this.<field>?.disconnect();` or `clearInterval(this.<field>);` to `disconnectedCallback()`. On subclasses of custom base classes, a newly created `disconnectedCallback()` automatically includes `super.disconnectedCallback?.();`.
- Observers and intervals created in `constructor()` (or outside `connectedCallback()`) offer an ESLint suggestion instead of an automatic fix, so reparenting an element in the DOM cannot silently break constructor-only setup.
- Pub/sub unsubscribers stored on `this.<field> = subscribe(...)` offer an ESLint suggestion to call `this.<field>?.()` in `disconnectedCallback()`.
