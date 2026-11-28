---
'@shopify/prettier-plugin-liquid': minor
---

Add the `jsoncSchema` option. When it is on, the contents of the `{% schema %}` tag are formatted as JSONC, so trailing commas follow the `trailingComma` option instead of always being removed. It needs Prettier 3.2 or later and is ignored on older versions.
