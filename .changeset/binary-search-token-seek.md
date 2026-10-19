---
'@shopify/liquid-html-parser': patch
---

Find the token after an HTML comment, `<script>`/`<style>`/`<svg>`, or raw Liquid tag by binary search instead of scanning from the start, so files with many of them no longer parse in quadratic time.
