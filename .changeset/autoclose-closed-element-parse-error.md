---
'@shopify/theme-language-server-common': patch
---

Stop inserting a second closing tag when you type `>` on an element that is already closed, while an ancestor is unclosed and later syntax doesn't parse, as in `<div><p>|</p>{{ unfinished`.
