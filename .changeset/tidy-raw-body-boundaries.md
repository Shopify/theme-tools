---
'@shopify/liquid-html-parser': patch
---

Keep Liquid raw bodies within their closing tags during tokenization, preserving following content and enclosing HTML attribute context. Reuse closing offsets for built-in tags, recover boundaries when custom tag registrations change during parsing, and keep parse time proportional to the source for documents with many raw tags.
