---
'@shopify/theme-check-common': patch
---

Stop `LiquidHTMLSyntaxError` from splitting loop lookups with spaces in quoted keys, such as `product.options_by_name['hello world']`, and from deleting part of them in its fix.
