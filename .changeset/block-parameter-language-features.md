---
'@shopify/theme-language-server-common': patch
---

Complete and hover `block` tag arguments from the target block's schema settings, LiquidDoc parameters, and built-in `content`.

Completion offers plain parameter names with schema-derived value templates and skips arguments the call already passes. Hover shows the schema type, merchant-facing setting details, LiquidDoc text and requiredness, and marks LiquidDoc-only parameters as developer-only. The `block` tag is offered only in `templates/**/*.liquid` and `layout/*.liquid` files.
