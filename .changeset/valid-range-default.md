---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'theme-check-rs': minor
---

Add the `ValidRangeDefault` and `ValidRangeStepCount` checks for `range` settings. The storefront rejects both problems with an "Invalid schema" error that breaks `shopify theme dev` and the theme editor, though `shopify theme push` accepts them.

- `ValidRangeDefault` reports a `default`, preset value or section `default.settings` value that is outside `[min, max]` or off the `step` grid, such as `{ "type": "range", "min": 0, "max": 160, "step": 8, "default": 60 }`.
- `ValidRangeStepCount` reports a range setting with more than 101 steps, such as `{ "type": "range", "min": 0, "max": 200, "step": 1 }`, and suggests a step that fits.

Both checks read the range settings of sections, theme blocks, local blocks and `config/settings_schema.json`. A setting without `step` has a step of 1.
