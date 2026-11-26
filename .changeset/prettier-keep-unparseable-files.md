---
'@shopify/prettier-plugin-liquid': patch
---

Report a syntax error instead of formatting a template that doesn't parse, or that leaves a block or element open at the end. Before, the formatter skipped the part it couldn't read and closed what was left open, so it could write a different template, such as one with a second `{% endcapture %}` that no longer renders.
