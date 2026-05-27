---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/theme-language-server-common': patch
---

Add an `UnusedTranslationKey` check for default locale keys that are not statically referenced.

Use preloaded theme files when collecting translation references for language server diagnostics.
