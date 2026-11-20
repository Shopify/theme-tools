---
'@shopify/theme-check-common': patch
---

Fix JSONMissingBlock resolving valid app block URIs as local files, and report app blocks whose immediate host does not allow `@app` as errors, including hosts with only named blocks or no blocks.
