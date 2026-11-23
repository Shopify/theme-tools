# `@shopify/eslint-plugin-theme`

ESLint rules for Shopify theme JavaScript best practices, helping custom elements stay resilient when sections or elements are dynamically re-rendered or replaced.

## Installation

```sh
npm install --save-dev eslint @shopify/eslint-plugin-theme
```

Requires ESLint 9 or later (flat config).

## Usage

Add the recommended configuration to your `eslint.config.js`:

```js
import theme from '@shopify/eslint-plugin-theme';

export default [
  theme.configs.recommended,
];
```

To customize rule severity or options:

```js
import theme from '@shopify/eslint-plugin-theme';

export default [
  {
    plugins: { theme },
    rules: {
      'theme/no-stored-outside-element': ['warn', { checkClosest: false }],
      'theme/require-guarded-custom-element-define': 'error',
    },
  },
];
```

## Rules

| Rule | Description | Recommended | Fix / Suggest |
| --- | --- | --- | --- |
| [`theme/require-guarded-custom-element-define`](./docs/rules/require-guarded-custom-element-define.md) | Require guarding `customElements.define()` with `customElements.get()` | `warn` | Autofix |
| [`theme/no-stored-outside-element`](./docs/rules/no-stored-outside-element.md) | Disallow storing document-wide DOM lookups on custom element instances | `warn` | Suggestion |
| [`theme/require-listener-cleanup`](./docs/rules/require-listener-cleanup.md) | Require cleaning up global or outside-element event listeners in `disconnectedCallback()` | `warn` | Autofix (`connectedCallback`) |
| [`theme/require-teardown`](./docs/rules/require-teardown.md) | Require disconnecting observers, clearing intervals, and unsubscribing in `disconnectedCallback()` | `warn` | Autofix / Suggestion |
| [`theme/require-page-state-cleanup`](./docs/rules/require-page-state-cleanup.md) | Require undoing `document.body` / `document.documentElement` state mutations in `disconnectedCallback()` | `warn` | Suggestion |
| [`theme/no-stale-element-after-await`](./docs/rules/no-stale-element-after-await.md) | Disallow using a document-queried local variable after `await`, `.then()`, or `setTimeout()` without checking `isConnected` | `warn` | — |
