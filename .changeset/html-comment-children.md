---
'@shopify/liquid-html-parser': minor
'@shopify/prettier-plugin-liquid': patch
'@shopify/theme-check-common': patch
'@shopify/theme-language-server-common': patch
---

Parse the Liquid inside HTML comments. Liquid renders it, and its tags can open, branch and close blocks, so `{% if a %}<!-- {% endif %} -->` no longer fails with an unclosed `if`.

- `HtmlComment` has `children` (text and Liquid) and `blockStartPosition`/`blockEndPosition` for its delimiters.
- A comment that crosses a Liquid block boundary is split there, and each part has an empty delimiter range on the split side.
- A comment that never closes ends at the end of the file, as in a browser.
- An end tag in a comment that closes no block is a parse error, as in Liquid.
- The `opaqueHtmlComments` option keeps comment bodies opaque.

Checks now see the Liquid in HTML comments, completions work inside them, and prettier prints split and unclosed comments as written.
