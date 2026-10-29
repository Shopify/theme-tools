---
'@shopify/liquid-html-parser': patch
---

Find the parser's position after each HTML comment and `<script>`, `<style>` or `<svg>` element with a binary search instead of rescanning from the first token, avoiding quadratic token re-scanning in files with many of these nodes.
