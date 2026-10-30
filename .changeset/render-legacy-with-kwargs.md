---
'@shopify/liquid-html-parser': patch
---

Parse legacy `{% render 'x' with key: value %}` and `{% include %}` markup as Liquid does: `key` is both the `with` variable and a named argument. An `as` alias and further named arguments may follow. After regular named arguments, `as` is still not an alias.
