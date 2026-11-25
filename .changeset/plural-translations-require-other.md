---
'@shopify/theme-check-common': minor
---

`MatchingTranslations` now reports pluralized entries in the storefront default locale that are missing `other`. The storefront falls back to `other` when a count has no matching key, and raises an error when `other` is missing too.
