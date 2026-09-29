---
'@shopify/theme-language-server-common': patch
---

Complete and hover `block` tag arguments from the target block's schema settings, LiquidDoc parameters, and built-in `content`.

Completion offers plain parameter names with schema-derived value templates and skips arguments the call already passes. Completion and hover show requiredness, the Liquid type, the LiquidDoc description, and the theme setting's label and info, resolving `t:` keys from the default schema locale. The `block` tag is offered only in `templates/**/*.liquid` and `layout/*.liquid` files.
