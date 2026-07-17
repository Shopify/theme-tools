---
'@shopify/theme-check-common': minor
---

Port additional theme-check checks

Add the following checks:
  - `LiquidComplexity` -- Reports Liquid files with high cyclomatic complexity (default threshold 120).
  - `LiquidNestingDepth` -- Reports Liquid files with deeply nested control-flow structures (default max depth 10).
  - `LiquidSyntaxError` -- Reports Liquid syntax errors.
  - `MaxFileSize` -- Reports theme files that exceed Shopify's maximum per-file size.
  - `ExcessiveSettingsCount` -- Reports section/block schemas declaring more top-level settings than the max (default 40).
  - `BlockArgumentSettingCollision` -- Reports a plain block-tag argument whose name matches a setting id in the block's schema.
  - `DuplicateBlockArguments` -- Reports duplicate argument names in a block tag.
  - `MissingBlockArguments` -- Reports required `{% doc %}` arguments not provided on a block tag.
  - `UnknownBlockSetting` -- Reports a `block.settings.<name>` argument where `<name>` is not in the block's schema.
  - `UnrecognizedBlockArguments` -- Reports block-tag arguments not declared in the block's `{% doc %}` tag.
  - `ValidBlockArgumentTypes` -- Reports type mismatches between block-tag arguments and their `{% doc %}` declarations.
  - `SchemaOncePerFile` -- Reports when `{% schema %}` appears more than once in a file.
  - `SchemaSectionOrBlockOnly` -- Reports `{% schema %}` used outside section or block files.
  - `StylesheetOncePerFile` -- Reports when `{% stylesheet %}` appears more than once in a file.
  - `StylesheetTagInWrongFile` -- Reports `{% stylesheet %}` used outside section, block, or snippet files.
  - `JavascriptOncePerFile` -- Reports when `{% javascript %}` appears more than once in a file.
  - `JavascriptTagInWrongFile` -- Reports `{% javascript %}` used outside section, block, or snippet files.

`RequiredLayoutThemeObject` now flags any `layout/*.liquid` file missing the required theme objects, not just `layout/theme.liquid`.
