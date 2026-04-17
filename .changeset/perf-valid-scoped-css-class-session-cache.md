---
'@shopify/theme-check-common': patch
'@shopify/theme-language-server-common': patch
---

Reduce `ValidScopedCSSClass` save latency on large themes. Parsing of theme-wide stylesheets is now reused across saves within a language-server session and only invalidated for the file the user just edited. Also skips full syntax-tree parsing of Liquid files that contain no stylesheet tag at all. Fixes the save-lag reported in [#1179](https://github.com/Shopify/theme-tools/issues/1179).
