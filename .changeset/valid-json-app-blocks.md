---
'@shopify/theme-check-common': patch
---

Fix JSONMissingBlock resolving app block URIs as local theme block files. Require `@app` support on the immediate section or block host, while preserving named section-local blocks and theme block validation.
