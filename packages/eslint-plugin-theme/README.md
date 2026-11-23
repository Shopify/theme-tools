# `@shopify/eslint-plugin-theme`

ESLint rules for Shopify theme JavaScript.

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
    },
  },
];
```

## Rules

| Rule | Description | Recommended | Suggestions |
| --- | --- | --- | --- |
| [`theme/no-stored-outside-element`](./docs/rules/no-stored-outside-element.md) | Disallow storing the result of document-wide DOM lookups on custom element instances | `warn` | Yes |
