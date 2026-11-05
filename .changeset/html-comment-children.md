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

**Behavior changes**

- Code that walks `children` now visits the Liquid and text inside HTML comments.
- `<!-- {% if a %} --><p>x</p><!-- {% endif %} -->` is one comment whose `if` holds `<p>x</p>` as text, not two comments around a `<p>` element.
- `<!-- {% endif %} -->` with no open `if` no longer parses. An unclosed `<!--` and `{% if a %}<!-- {% endif %} -->` now parse.
- Code that creates `HtmlComment` nodes must set `children`, `blockStartPosition` and `blockEndPosition`.

Pass `opaqueHtmlComments: true` to get the previous tree for these templates.

Checks now see the Liquid in HTML comments, and completions work inside them. Prettier prints an unclosed comment as written, and can move whitespace and line breaks inside a comment that holds a Liquid block or is split by one.
