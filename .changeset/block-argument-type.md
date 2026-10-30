---
'@shopify/liquid-html-parser': minor
'@shopify/theme-language-server-common': patch
---

Type `{% block %}` and `{% section %}` arguments as one `BlockArgument`, whose value is a scalar or a single-level array literal, instead of a `LiquidNamedArgument | BlockArrayArgument` union. Completions narrow on the argument's value.
