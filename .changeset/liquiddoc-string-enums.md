---
'@shopify/theme-check-common': minor
---

Support string enums in LiquidDoc parameter types

`@param` accepts unions of string literals, such as `{'heading' | 'small'}`, and literal arguments to `render`, `content_for` and `block` are checked against them.
