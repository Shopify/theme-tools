# `theme/require-guarded-custom-element-define`

Require guarding `customElements.define()` with `customElements.get()`.

## Why this rule exists

If a section's `<script>` re-executes during a dynamic section update or is included more than once, calling `customElements.define('my-element', MyElement)` a second time throws a `DOMException` (`NotSupportedError`) and aborts the rest of the script.

## Examples

### Incorrect

```js
customElements.define('cart-drawer', CartDrawer);
```

### Correct

```js
if (!customElements.get('cart-drawer')) {
  customElements.define('cart-drawer', CartDrawer);
}
```

## Autofix

This rule is autofixable (`eslint --fix`). Standalone `customElements.define(...)` statements with side-effect-free tag expressions are wrapped in `if (!customElements.get(...)) { ... }`.
