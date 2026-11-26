---
'@shopify/theme-check-common': patch
'theme-check-rs': patch
---

Accept fixed-value settings on canonical inline app block tags.

`LiquidSyntaxError` allows plain setting arguments whose values are strings, numbers, booleans or flat arrays of those. Dynamic sources remain supported as strings such as `'{{ closest.product.title }}'`. Expressions, `nil`/`null`, `empty`/`blank`, namespaced setting arguments and body content remain invalid. Theme block arguments are unchanged.
