---
'@shopify/liquid-html-parser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/theme-language-server-common': patch
'@shopify/theme-graph': patch
---

Accept canonical app block paths in `{% block %}` tags.

The parser accepts `shopify://apps/<app>/blocks/<handle>/<uuid>` as a block type and keeps rejecting malformed app paths. `LiquidSyntaxError` reports arguments and content on app block paths, because app blocks render with the settings their app provides. `block.name` stays allowed.

App block paths do not produce local theme-file document links or dependencies in the theme graph.
