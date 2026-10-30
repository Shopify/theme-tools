---
'@shopify/liquid-html-parser': patch
---

Accept `reversed` anywhere among `for` and `tablerow` arguments, as Liquid does. `{% for x in c limit: 5 reversed %}` used to fall back to string markup.
