---
'@shopify/liquid-html-parser': patch
---

Stop parsing an incomplete HTML start tag before its enclosing Liquid block terminator so tolerant formatting preserves the original source.
