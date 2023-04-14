---
'@shopify/theme-check-common': minor
---

Breaking: create one context per file

The API for creating checks has changed:
- We no longer pass a `file` argument to every method
- `file` is now accessible from the `Context` object
- We now create one context per file to avoid subtle state bugs
