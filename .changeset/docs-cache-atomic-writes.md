---
'@shopify/theme-check-docs-updater': patch
---

Update the docs cache as a whole. Each update downloads into a new folder and swaps it in, so a failed download keeps the old docs and is retried on the next run, and files removed upstream no longer linger.
