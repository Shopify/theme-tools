---
'@shopify/liquid-html-parser': patch
---

Fix the end of an unclosed block in `{% liquid %}`. It ended past the end of the template, as if its end tag came after the last line. It now ends where the last line does, as an unclosed block outside `{% liquid %}` does.
