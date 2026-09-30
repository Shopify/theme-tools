---
'@shopify/theme-language-server-common': minor
---

Support LiquidDoc string enums in hovers and completions

Allowed values are kept through assignments, and `render`, `content_for` and `block` parameter completions insert the first one. The `default` filter widens enum values to `string`.
