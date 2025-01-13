---
'@shopify/theme-check-common': minor
---

This update ensures that the AppBlockMissingSchema theme check will only run on block files on theme app extensions, to avoid errors surfacing when the theme check is incorrectly run on snippets. Renamed the check to make it more accurate (from MissingSchema to AppBlockMissingSchema).
