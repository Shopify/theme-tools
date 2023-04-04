# @shopify/theme-check-node

## 1.2.0

### Patch Changes

- Updated dependencies [4c099d5]
- Updated dependencies [4c099d5]
  - @shopify/theme-check-common@1.2.0

## 1.1.0

### Minor Changes

- f4a2f27: Simplify public API

  Breaking changes:

  - `Theme` is `SourceCode<S>[]` instead of `{ files: Map<string, SourceCode<S>> }`
  - `SourceCode` no longer has a `relativePath` property
  - `toSourceCode` no longer takes a `relativePath` as argument
  - `Config` has a `root` property

- 37fc98a: Add dependencies to public API

  - `fileExists(absolutePath: string): Promise<boolean>` returns true when a file exists
  - `getDefaultTranslations(): Promise<JSONObject>` returns the parsed JSON contents of the default translations file

  These dependencies are now added to the `context` object and are usable by checks.

  Those exists as a lean way to get rid of the assumptions that all files are in the `Theme` object. We should be able to go a long way with these.

### Patch Changes

- Updated dependencies [f4a2f27]
- Updated dependencies [37fc98a]
  - @shopify/theme-check-common@1.1.0

## 1.0.1

### Patch Changes

- d206674: Move toSourceCode to common for use in language-server-common
- Updated dependencies [d206674]
  - @shopify/theme-check-common@1.0.1

## 1.0.0

### Major Changes

- 233f00f: Initial release
