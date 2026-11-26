---
'@shopify/prettier-plugin-liquid': patch
---

Report a syntax error instead of formatting a template that doesn't parse. Before, the formatter skipped the part it couldn't read and could print a different template, such as one with a second `{% endcapture %}` that no longer renders.
