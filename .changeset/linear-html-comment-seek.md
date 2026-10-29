---
'@shopify/liquid-html-parser': patch
---

Find the parser's position after each HTML comment, `<script>`, `<style>` or `<svg>` element and raw Liquid tag, like `{% raw %}` or `{% comment %}`, with a binary search instead of rescanning from the first token, avoiding quadratic token re-scanning in files with many of these nodes.
