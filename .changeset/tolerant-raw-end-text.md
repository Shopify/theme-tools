---
'@shopify/liquid-html-parser': patch
---

Keep tolerant parsing proportional to the source for documents with many unclosed `{% raw %}` or `{% comment %}` tags followed by plain `endraw` or `endcomment` text. Each unclosed tag no longer searches the rest of the document again when that text appears after it.
