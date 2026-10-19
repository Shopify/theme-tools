---
'@shopify/liquid-html-parser': patch
---

Find the token after an HTML comment, `<script>`/`<style>`/`<svg>`, or raw Liquid tag by binary search instead of scanning from the start, so comment-heavy files no longer parse in quadratic time. Raw Liquid tags whose body holds a stray `{{` or `{%` still re-tokenize the rest of the file and stay slow.
