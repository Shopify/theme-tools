---
'@shopify/theme-check-common': minor
---

Add two checks for `range` setting structural validity:

- `ValidRangeDefault` — errors when a `range` setting's `default` value is outside `[min, max]` or not aligned to the `step` grid. Catches schemas like `{ "type": "range", "min": 0, "max": 160, "step": 8, "default": 60 }` that the storefront rejects with `Invalid schema: setting with id="…" default must be a step in the range`.
- `ValidRangeStepCount` — errors when a range setting has more than 101 discrete steps. Catches schemas like `{ "type": "range", "min": 0, "max": 200, "step": 1 }` that the storefront rejects with `Invalid schema: setting with id="…" step invalid. Range settings must have at most 101 steps`.

Both checks validate setting defaults, preset setting values, section `default.settings` values, and `config/settings_schema.json`. Both are runtime failures that the CLI happily uploads but `shopify theme dev` and the theme editor reject as hard schema errors.
