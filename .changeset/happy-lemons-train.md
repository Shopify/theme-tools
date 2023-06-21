---
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add support for `.theme-check.yml` config files

**New features**:
- Developers can write their own checks and publish them to [npm](https://npmjs.com)

  Modules that follow the `@scope/theme-check-*` or `theme-check-*` naming conventions are automatically loaded.

  The `require` property of the configuration file can be used to load checks that do not follow the naming convention.

  See [Creating a Theme Check extension](docs/writing-your-own-check/index.md) for more info.

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
- `require: []` this can be used to load unconventional (or private) `theme-check-js` checks. Ruby checks are not supported.

**Breaking changes**:
- Custom checks written in Ruby won't work Theme Check in TypeScript
- The `*` (star) glob in `ignore` configurations does not capture the forward slash (`/`) unless at the end of the pattern.

  Fix: replace `*` by `**`.

  This comes from a difference between how `minimatch` and Ruby handles file globs.

Extra care has been placed to make the transition as smooth as possible.
