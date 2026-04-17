---
'@shopify/theme-check-common': patch
'@shopify/theme-check-node': patch
---

Temporarily remove `ValidScopedCSSClass` from the recommended config. The check causes severe save lag in VS Code on larger themes (see [#1179](https://github.com/Shopify/theme-tools/issues/1179)) because it re-parses every `{% stylesheet %}` tag in the theme on every save. It remains available as an opt-in check. Will be re-enabled once the performance issue is resolved.
