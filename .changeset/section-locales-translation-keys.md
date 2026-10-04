---
'@shopify/theme-check-common': patch
---

Stop `TranslationKeyExists` from reporting `sections.<section-name>.<key>` translations that are defined in the section's own schema `locales`.
