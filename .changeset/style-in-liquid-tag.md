---
'@shopify/liquid-html-parser': patch
'@shopify/theme-check-common': patch
'theme-check-rs': patch
---

Parse the body of a `style` tag inside `{% liquid %}` as Liquid statements. Before, it was one text node, so checks such as `UnusedAssign` missed the variables used there.
