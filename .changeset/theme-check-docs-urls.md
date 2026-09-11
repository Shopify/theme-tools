---
'@shopify/theme-check-common': patch
---

Add missing `docs.url` links so editors surface a "learn more" link on these diagnostics:
`LiquidComplexity`, `LiquidNestingDepth`, `LiquidSyntaxError`, `ExcessiveSettingsCount`,
`BlockArgumentSettingCollision`, `UnknownBlockSetting`, `MaxFileSize` (Liquid and JSON variants),
`SchemaSectionOrBlockOnly`, `SchemaOncePerFile`, `JavascriptTagInWrongFile`, `JavascriptOncePerFile`,
`StylesheetTagInWrongFile`, and `StylesheetOncePerFile`.
