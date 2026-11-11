---
'@shopify/theme-check-common': patch
---

Fix JSONMissingBlock resolving app block URIs as local theme block files. Require `@app` support on the immediate section or block host, while preserving section blocks and theme block validation.

As before, host permission checks are skipped when the host schema is missing, invalid, or cannot be validated. App support alone does not enable theme block file validation for a host.
