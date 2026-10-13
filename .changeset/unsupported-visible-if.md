---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add `UnsupportedVisibleIf` check, which warns when `visible_if` is set on a setting type that ignores it (resource pickers like `product` or `collection`, `color_scheme_group` and `color_palette`). Shopify accepts these files but always shows the setting in the theme editor. `ValidVisibleIf` no longer validates `visible_if` expressions on those setting types.
