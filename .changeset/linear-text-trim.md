---
'@shopify/liquid-html-parser': patch
---

Trim whitespace around Liquid tags with `trimStart()`/`trimEnd()` instead of regular expressions. The trailing-whitespace regex was quadratic in the length of a whitespace run and was the single most expensive step of parsing a typical theme.
