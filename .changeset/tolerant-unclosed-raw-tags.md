---
'@shopify/liquid-html-parser': patch
---

Keep tolerant parsing proportional to the source for documents with many unclosed `{% raw %}` or `{% comment %}` tags. Each unclosed tag no longer searches the rest of the document again, and nested comments reuse what an enclosing search found.
