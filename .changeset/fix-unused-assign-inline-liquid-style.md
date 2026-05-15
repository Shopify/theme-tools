---
'@shopify/liquid-html-parser': patch
---

Fix false-positive UnusedAssign warnings for variables used inside a `style` block within an inline `{% liquid %}` tag. The inline-liquid raw-tag CST mapping parsed every raw-tag body as plain text, so variable references inside `{% liquid ... style ... echo foo ... endstyle %}` never became AST nodes and checks that walk the tree saw no usage. The mapping now mirrors the top-level `liquidRawTagImpl` behavior: `schema` and `raw` remain text, all other raw tags are parsed as Liquid so references inside `style` and friends are preserved. Fixes Shopify/theme-tools#465.
