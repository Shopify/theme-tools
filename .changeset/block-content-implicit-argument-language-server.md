---
'@shopify/theme-language-server-common': patch
---

Complete and hover the implicit `content` parameter inside `blocks/*.liquid`.

Bare `content` is a `string` variable in every theme block file, and `block.content` is a `string` property there. A later assign or capture changes the variable's type from that point. A schema setting or LiquidDoc parameter named `content` keeps the `string` type.
