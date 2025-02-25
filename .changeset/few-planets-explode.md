---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Introduce a new theme check which validates the types of parameters passed to snippets against the liquidDoc header.

- Reports type mismatches
- Suggests autofixes (replace with default or remove value)
- Skips type checking for variable lookups
- Skips type checking for unknown parameters
- Skips type checking for unknown types
