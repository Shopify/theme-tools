---
'@shopify/liquid-html-parser': minor
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
'@shopify/prettier-plugin-liquid': minor
'@shopify/theme-graph': minor
---

Adopt the hand-written `liquid-html-parser` for performance

Replace the parser-combinator-based Liquid/HTML parser with a hand-written
recursive-descent parser. The new parser is significantly faster, adds
resilient parsing (it recovers from malformed input instead of bailing), and is
adapted to the theme-tools source model. `theme-language-server-common`,
`theme-check-common`, `prettier-plugin-liquid`, and `theme-graph` are updated to
consume the new parser.
