---
'@shopify/theme-check-common': minor
'@shopify/theme-language-server-common': minor
---

Add support for union types and string literal types in `{% doc %}` `@param` annotations.

Named types can now be combined with `|`: `{string|number}`

String literals are now valid param types: `{'banner'|'label'}`

Unions of named types and literals are also supported: `{string|'banner'|'label'}`
