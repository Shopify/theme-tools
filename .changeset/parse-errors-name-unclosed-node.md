---
'@shopify/liquid-html-parser': patch
---

Name the node that was never closed in a parse error's `unclosed` again. The hand-written parser had left it `null`, so the language server inserted the wrong closing tag when you typed `>`.
