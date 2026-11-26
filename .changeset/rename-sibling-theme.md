---
'@shopify/theme-language-server-common': patch
---

A theme no longer includes the files of a sibling theme whose directory name starts with the same text, such as `themes/shop-preview` for `themes/shop`. Renaming a section, block, snippet or asset in one theme no longer edits the other one.
