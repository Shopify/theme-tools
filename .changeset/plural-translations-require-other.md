---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Require `other` in pluralized storefront default locale entries with `MatchingTranslations`. The new `requireOther` option defaults to `true`; set it to `false` to disable this requirement while keeping missing and extra translation diagnostics. Schema locales and plural categories in other languages are unchanged. Reports the offending entry without inventing a translation or offering an automatic fix.
