---
'@shopify/theme-language-server-common': patch
---

Preserve the element type when piping a typed value through `sort`, `sort_natural`, `reverse`, `uniq`, `compact` or `where`. Previously these filters collapsed the type to `untyped[]` because their `array_value` is declared as `untyped` in the filter docs; they are now treated as pass-through in the type system. Fixes #1086.
