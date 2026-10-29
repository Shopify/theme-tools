---
'@shopify/liquid-html-parser': patch
---

Find the parser's position after each HTML comment, `<script>`, `<style>` or `<svg>` element and raw Liquid tag, like `{% raw %}` or `{% comment %}`, with a binary search instead of rescanning from the first token. When a stray `{{` or `{%` in a raw Liquid tag's body runs past its end tag, re-tokenize the rest of the file only as far as the parser reads it, instead of in full. Both avoid quadratic work in files with many of these nodes.
