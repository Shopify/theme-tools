# @shopify/theme-check-node

## 1.12.0

### Minor Changes

- 65bdebb: Fixed bug for `AssetUrlFilters` check
- 65bdebb: Add `ContentForHeaderModification` check
- 65bdebb: Add `AssetSizeAppBlockJavascript` check
- 65bdebb: Add `AssetSizeAppBlockCSS` check

### Patch Changes

- Updated dependencies [65bdebb]
- Updated dependencies [65bdebb]
- Updated dependencies [65bdebb]
- Updated dependencies [65bdebb]
  - @shopify/theme-check-common@1.12.0

## 1.11.1

### Patch Changes

- 2e73166: Fix the `DocsetEntry` types to better match the theme-liquid-docs json files
- Updated dependencies [2e73166]
  - @shopify/theme-check-common@1.11.1

## 1.11.0

### Minor Changes

- e67a16d: Breaking: Dependency injected json schema validators

### Patch Changes

- Updated dependencies [e67a16d]
  - @shopify/theme-check-common@1.11.0

## 1.10.0

### Minor Changes

- 4db7c7e: Add `UnknownFilter` check
- a94f23c: Bump prettier-plugin-liquid to v1.2.1

### Patch Changes

- Updated dependencies [4db7c7e]
- Updated dependencies [a94f23c]
  - @shopify/theme-check-common@1.10.0

## 1.9.0

### Minor Changes

- b3ed3b9: Add `ValidSchema` check
- d19500f: Add `AppBlockValidTags` check
- 8e76424: Add support for `.theme-check.yml` config files

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

- 3096e53: Add `ValidHTMLTranslation` check
- daf5189: Add `AssetPreload` check
- 6fb9db9: Add `ImgLazyLoading` check

### Patch Changes

- Updated dependencies [b3ed3b9]
- Updated dependencies [d19500f]
- Updated dependencies [8e76424]
- Updated dependencies [3096e53]
- Updated dependencies [daf5189]
- Updated dependencies [6fb9db9]
  - @shopify/theme-check-common@1.9.0

## 1.8.0

### Minor Changes

- 2f0f941: Add `MissingAsset` check
- fd3fc3c: Add `AssetUrlFilters`
- 5ae97c9: Add `PaginationSize` check
- 85cf8f3: Add `CdnPreconnect`
- 051aff1: Introduce `ThemeDocset` and `ThemeSchemas` dependencies to support core checks

### Patch Changes

- Updated dependencies [2f0f941]
- Updated dependencies [fd3fc3c]
- Updated dependencies [5ae97c9]
- Updated dependencies [85cf8f3]
- Updated dependencies [051aff1]
  - @shopify/theme-check-common@1.8.0

## 1.7.1

### Patch Changes

- Bump prettier-plugin-liquid to v1.1.0
- Updated dependencies
  - @shopify/theme-check-common@1.7.1

## 1.7.0

### Minor Changes

- 502bad8: Add documentation URLs to checks

### Patch Changes

- Updated dependencies [502bad8]
  - @shopify/theme-check-common@1.7.0

## 1.6.0

### Minor Changes

- 9e99728: Add `UnusedAssign`
- f99c896: Add `LiquidHTMLSyntaxError`
- e0c131a: Add `JSONSyntaxError`
- e0c131a: Breaking: `SourceCode` can take `ast: AST[T] | Error`, where `Error` is a parsing error
- ccd5146: Add `DeprecatedLazysizes`
- c715fbe: Add `ImgWidthAndHeight`
- 9e99728: Add `RequiredLayoutThemeObject`
- edd8925: Add `DeprecateBgsizes`

### Patch Changes

- 9d3d557: Fix RequiredLayoutThemeObject bugs
- Updated dependencies [cad8e17]
- Updated dependencies [9e99728]
- Updated dependencies [f99c896]
- Updated dependencies [e0c131a]
- Updated dependencies [e0c131a]
- Updated dependencies [ccd5146]
- Updated dependencies [c715fbe]
- Updated dependencies [9e99728]
- Updated dependencies [9d3d557]
- Updated dependencies [edd8925]
  - @shopify/theme-check-common@1.6.0

## 1.5.1

### Patch Changes

- 60c92be: Fix unhandled TranslationKeyExists error
- Updated dependencies [60c92be]
  - @shopify/theme-check-common@1.5.1

## 1.5.0

### Minor Changes

- 71e6b44: Add support for fixes and suggestions

  **New**: `context.report` now accepts two new properties:

  - `fix: Fixer`, accepts a callback that is given a corrector and produces transformations that are deemed **safe to apply without confirmation** on the initial document.

    - JSON checks will receive a [`JSONCorrector` (API)](packages/common/src/fixes/correctors/json-corrector.ts)
    - LiquidHTML checks will receive a [`StringCorrector` (API)](packages/common/src/fixes/correctors/string-corrector)

    ```typescript
    type Fixer<S> = (corrector: Corrector<S>) => void;
    ```

  - `suggest: Suggestion[]`, accepts an array of Suggestion. Those are like fixes but are not considered safe either because there's multiple ways to fix the problem or because the change requires care.

    ```typescript
    type Suggestion<S> = {
      message: String;
      fix: Fixer<S>;
    };
    ```

  Example usage:

  ```typescript
  // A safe change, add a "TODO" translation key
  context.report({
    message: `The translation for '${path}' is missing`,
    startIndex: closest.loc!.start.offset,
    endIndex: closest.loc!.end.offset,
    fix(corrector) {
      // corrector is inferred to be a JSONCorrector
      corrector.add(path, 'TODO');
    },
  });

  // An unsafe change, add `defer` or `async` attributes on the script tag
  context.report({
    message: 'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
    startIndex: node.position.start,
    endIndex: node.position.end,
    suggest: [{
      message: 'Add defer attribute',
      fix: corrector => {
        // corrector is inferred to be a StringCorrector
        corrector.insert(node.blockStartPosition.end, ' defer')
      },
    }, {
      message: 'Add async attribute',
      fix: corrector => {
        // corrector is inferred to be a StringCorrector
        corrector.insert(node.blockStartPosition.end, ' async')
      };
    }],
  })
  ```

  Under the hood, corrector calls will be converted into a list of `Fix` objects.

  One can implement a `FixApplicator` (a async function that takes a `SourceCode` and `Fix` objects) to apply fixes in different contexts.

  - In Node.js, we'll implement a `FixApplicator` that applies the fixes to the initial file and then save the changes to disk.
  - In the Language Server, we'll implement `FixApplicator`s that turn the `Fix`es into `TextEdit` objects.

  **New**: the top level API now offers the `autofix` function, one that takes a `FixApplicator` as argument.

  This `autofix` function applies all the _safe_ changes (and ignores suggestions).

### Patch Changes

- Updated dependencies [71e6b44]
  - @shopify/theme-check-common@1.5.0

## 1.4.1

### Patch Changes

- a8cda19: Add TranslationKeyExists to allChecks array
- Updated dependencies [9f8d47f]
- Updated dependencies [a8cda19]
  - @shopify/theme-check-common@1.4.1

## 1.4.0

### Minor Changes

- 9d419ca: Breaking: change dependency `get defaultLocale` to `getDefaultLocale(): Promise<string>`

### Patch Changes

- Updated dependencies [9d419ca]
  - @shopify/theme-check-common@1.4.0

## 1.3.0

### Minor Changes

- 72a9330: Breaking: Add `defaultLocale` dependency
- 72a9330: Add check TranslationKeyExists
- 5329963: Breaking: change signature of `getDefaultTranslations` to return a `Promise<Translations>`

### Patch Changes

- Updated dependencies [72a9330]
- Updated dependencies [5329963]
- Updated dependencies [72a9330]
- Updated dependencies [5329963]
  - @shopify/theme-check-common@1.3.0

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
