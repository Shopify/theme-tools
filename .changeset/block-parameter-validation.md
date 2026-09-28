---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Validate block calls against the merged schema, LiquidDoc, and built-in content interface.

Schema settings define plain arguments, types, and merchant visibility without making arguments required. LiquidDoc controls requiredness for every parameter it declares, including schema-backed parameters and `content`. Schema-only parameters and built-in `content` without LiquidDoc are optional.

Theme Check reports incompatible types between schema, LiquidDoc, and built-in content declarations.

`LiquidSyntaxError` now rejects the unsupported experimental `block.settings.<id>` and `block.content` caller arguments, and every other dotted block argument except `block.name`. The obsolete `BlockArgumentSettingCollision` and `UnknownBlockSetting` checks are removed from check registration and generated configs.
