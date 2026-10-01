---
'@shopify/theme-check-common': patch
---

Wait for nested block validation in `ValidBlockTarget` and referenced block validation in `ValidSettingsKey`. Neither was awaited, so their offenses could arrive after `check()` returned and be lost.
