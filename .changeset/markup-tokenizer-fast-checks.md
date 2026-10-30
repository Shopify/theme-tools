---
'@shopify/liquid-html-parser': patch
---

Check character codes before running regular expressions or `startsWith` in the Liquid expression tokenizer and when looking for `{{`/`{%`. Tokens and ASTs are unchanged; parsing is 5–7% faster.
