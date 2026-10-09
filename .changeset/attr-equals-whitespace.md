---
'@shopify/liquid-html-parser': patch
---

Parse HTML attributes with whitespace around `=` (`data-ratio = '{{ r }}'`, `srcset= "…"`) as one attribute, as browsers do, instead of splitting the value into junk attributes.
