---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add DuplicateRenderSnippetParams theme check

Introduces a new theme check to detect and report duplicate parameters in Liquid render tags. The check:
- Identifies duplicate parameter names in render snippets
- Provides suggestions to remove redundant parameters

