---
'@shopify/theme-check-common': patch
---

Stop `UndefinedObject` from reporting schema settings used as bare variables in theme blocks. A block file can now use `{{ heading }}` for a `heading` setting without repeating it as a LiquidDoc `@param`.
