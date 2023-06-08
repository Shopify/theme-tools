---
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add support for `.theme-check.yml` config files

**New features**:
- `extends` can be an array
- `extends` can refer to node module dependencies
- `extends` also accepts "modern" config identifiers:
  - `theme-check:all` for all the checks and with default settings
  - `theme-check:recommended` for the recommended checks and settings
  - `theme-check:theme-app-extension` for theme app extensions

**Removed features**:
- `include_categories: []`
- `exclude_categories: []`

**Replaced features**:
- `require: []` this is now only used for non-node-module checks, `node_modules` checks are automatically loaded if configured.

**Breaking changes**:
- Custom checks written in Ruby won't work Theme Check in TypeScript
- The `*` (star) glob in `ignore` configurations does not capture the forward slash (`/`) unless at the end of the pattern.

  Fix: replace `*` by `**`.

  This comes from a difference between how `minimatch` and Ruby handles file globs.

Extra care has been placed to make the transition as smooth as possible.
