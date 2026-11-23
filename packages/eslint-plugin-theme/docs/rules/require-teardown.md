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

- Observers stored on `this.<field>` are autofixed by appending `this.<field>?.disconnect();` to `disconnectedCallback()`.
- Intervals stored on `this.<field>` are autofixed by appending `clearInterval(this.<field>);` to `disconnectedCallback()`.
- Pub/sub unsubscribers stored on `this.<field> = subscribe(...)` offer an ESLint suggestion to call `this.<field>?.()` in `disconnectedCallback()`.
