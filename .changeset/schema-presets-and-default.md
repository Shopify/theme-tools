---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add `SchemaPresetsAndDefault` check

Reports section schemas that define both `presets` and `default`, matching the platform validation that rejects them with `Invalid schema: cannot define both 'default' and 'presets'`.
