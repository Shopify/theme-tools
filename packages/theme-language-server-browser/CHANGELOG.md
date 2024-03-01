# @shopify/theme-language-server-browser

## 1.8.2

### Patch Changes

- @shopify/theme-language-server-common@1.8.2

## 1.8.1

### Patch Changes

- @shopify/theme-language-server-common@1.8.1

## 1.8.0

### Minor Changes

- 042f1e0: Breaking: internal rename of `schemaValidators` to `jsonValidationSet`

  This breaks the browser dependencies public API (for `startServer` and `runChecks`) and will thus require some code changes in those contexts.

  The node packages absorb the dependency injection and are not breaking.

- 042f1e0: Add section schema and translation file JSON completion and hover support

  JSON object authoring and editing should be better in the following contexts:

  - `sections/*.liquid` `{% schema %}` bodies
  - `locales/*.json` files

  Hovering over any key in any translation file will show the path of the translation key (for easy copy and paste).

  Pluralized strings and `_html` support is baked into the feature.

### Patch Changes

- Updated dependencies [042f1e0]
- Updated dependencies [042f1e0]
- Updated dependencies [a9ae65f]
  - @shopify/theme-language-server-common@1.8.0

## 1.7.7

### Patch Changes

- @shopify/theme-language-server-common@1.7.7

## 1.7.6

### Patch Changes

- @shopify/theme-language-server-common@1.7.6

## 1.7.5

### Patch Changes

- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [617b766]
  - @shopify/theme-language-server-common@1.7.5

## 1.7.4

### Patch Changes

- @shopify/theme-language-server-common@1.7.4

## 1.7.3

### Patch Changes

- Updated dependencies [7459e14]
  - @shopify/theme-language-server-common@1.7.3

## 1.7.2

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
  - @shopify/theme-language-server-common@1.7.2

## 1.7.1

### Patch Changes

- @shopify/theme-language-server-common@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [772a1ce]
- Updated dependencies [b05a6a8]
  - @shopify/theme-language-server-common@1.7.0

## 1.6.0

### Patch Changes

- Updated dependencies [a120393]
  - @shopify/theme-language-server-common@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [79b0549]
  - @shopify/theme-language-server-common@1.5.1

## 1.5.0

### Patch Changes

- Updated dependencies [78813ea]
- Updated dependencies [78813ea]
  - @shopify/theme-language-server-common@1.5.0

## 1.4.6

### Patch Changes

- @shopify/theme-language-server-common@1.4.6

## 1.4.5

### Patch Changes

- @shopify/theme-language-server-common@1.4.5

## 1.4.4

### Patch Changes

- Updated dependencies [aa33c5f]
  - @shopify/theme-language-server-common@1.4.4

## 1.4.3

### Patch Changes

- Updated dependencies [dacdd9f]
  - @shopify/theme-language-server-common@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [dbd5fb0]
  - @shopify/theme-language-server-common@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [54a9075]
  - @shopify/theme-language-server-common@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [23c84af]
- Updated dependencies [73a65e0]
- Updated dependencies [b27d8c7]
  - @shopify/theme-language-server-common@1.4.0

## 1.3.3

### Patch Changes

- @shopify/theme-language-server-common@1.3.3

## 1.3.2

### Patch Changes

- Updated dependencies [8d35241]
- Updated dependencies [201f30c]
- Updated dependencies [c0298e7]
- Updated dependencies [6fad756]
- Updated dependencies [fc86c91]
  - @shopify/theme-language-server-common@1.3.2

## 1.3.1

### Patch Changes

- Updated dependencies [f35feb4]
- Updated dependencies [d71a5e2]
  - @shopify/theme-language-server-common@1.3.1

## 1.3.0

### Patch Changes

- Updated dependencies [eb630b1]
  - @shopify/theme-language-server-common@1.3.0

## 1.2.1

### Patch Changes

- @shopify/theme-language-server-common@1.2.1

## 1.2.0

### Patch Changes

- Updated dependencies [380b273]
  - @shopify/theme-language-server-common@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [7457f2c]
- Updated dependencies [7457f2c]
  - @shopify/theme-language-server-common@1.1.0

## 1.0.2

### Patch Changes

- @shopify/theme-language-server-common@1.0.2

## 1.0.1

### Patch Changes

- 14b9ee2: Fixup package.json configs
- Updated dependencies [14b9ee2]
  - @shopify/theme-language-server-common@1.0.1

## 1.0.0

### Major Changes

- 319bcf1: `@shopify/theme-language-server` initial release

### Minor Changes

- acfac68: Rename `liquid-language-server-*` packages to `theme-language-server-*`

### Patch Changes

- Updated dependencies [8cd0b54]
- Updated dependencies [25b79f0]
- Updated dependencies [f3cda64]
- Updated dependencies [acfac68]
- Updated dependencies [319bcf1]
- Updated dependencies [4bb4b8d]
  - @shopify/theme-language-server-common@1.0.0

# @shopify/liquid-language-server-browser

## 1.7.1

### Patch Changes

- e8d569d: Subscribe to open/close notifications
- Updated dependencies [e8d569d]
  - @shopify/liquid-language-server-common@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
  - @shopify/liquid-language-server-common@1.7.0

## 1.6.0

### Minor Changes

- 8f2270f: Fixed: type of docset entry data rendered
- 6bad30d: Introduce Intelligent Code Completion foundations + Liquid tags completion provider
- 57f28a6: Bump `@shopify/theme-check-common` to v1.9.0

### Patch Changes

- f369925: Add ObjectCompletionProvider
- Updated dependencies [8f2270f]
- Updated dependencies [f369925]
- Updated dependencies [6bad30d]
- Updated dependencies [57f28a6]
  - @shopify/liquid-language-server-common@1.6.0

## 1.5.0

### Minor Changes

- 57f28a6: Bump `@shopify/theme-check-common` to v1.9.0

### Patch Changes

- Updated dependencies [57f28a6]
  - @shopify/liquid-language-server-common@1.5.0

## 1.4.1

### Patch Changes

- 28c8f88: Bump theme-check-common to v1.7.1
- Updated dependencies [28c8f88]
  - @shopify/liquid-language-server-common@1.4.1

## 1.4.0

### Minor Changes

- 0c50ec1: Bump theme-check to v1.6.0

  - e0c131a: Breaking: `SourceCode` can take `ast: AST[T] | Error`, where `Error` is a parsing error
  - 9e99728: Add `UnusedAssign`
  - f99c896: Add `LiquidHTMLSyntaxError`
  - e0c131a: Add `JSONSyntaxError`
  - ccd5146: Add `DeprecatedLazysizes`
  - c715fbe: Add `ImgWidthAndHeight`
  - 9e99728: Add `RequiredLayoutThemeObject`
  - edd8925: Add `DeprecateBgsizes`

- 08003be: Add support for Document Links
- 17668ba: Add suggestion quickfix support
- b2b0d5f: Add link to diagnostic documentation when available
- 17668ba: Add fix quickfix support
- 4e9d7c6: Add a "autofix" `source.fixAll` code action provider
- 2f86338: Add `themeCheck/runChecks` ExecuteCommandProvider

### Patch Changes

- Updated dependencies [0c50ec1]
- Updated dependencies [08003be]
- Updated dependencies [17668ba]
- Updated dependencies [b2b0d5f]
- Updated dependencies [17668ba]
- Updated dependencies [4e9d7c6]
- Updated dependencies [2f86338]
  - @shopify/liquid-language-server-common@1.4.0

## 1.3.3

### Patch Changes

- 81ec8c2: Normalize paths and URIs across platforms
- Updated dependencies [81ec8c2]
  - @shopify/liquid-language-server-common@1.3.3

## 1.3.2

### Patch Changes

- d16de84: Bump theme-check-common to v1.5.1
- Updated dependencies [d16de84]
  - @shopify/liquid-language-server-common@1.3.2

## 1.3.1

### Patch Changes

- Updated dependencies [d63cadb]
  - @shopify/liquid-language-server-common@1.3.1

## 1.3.0

### Minor Changes

- Bump @shopify/theme-check-common to v1.4.0

  - Adds new check: `TranslationKeyExists`

### Patch Changes

- Updated dependencies [6f5c92c]
- Updated dependencies
  - @shopify/liquid-language-server-common@1.3.0

## 1.2.2

### Patch Changes

- Use buffer value of default translations before the injected value
- Updated dependencies
  - @shopify/liquid-language-server-common@1.2.2

## 1.2.1

### Patch Changes

- d4682a6: Reexport theme-check-common interfaces
- Updated dependencies [d4682a6]
  - @shopify/liquid-language-server-common@1.2.1

## 1.2.0

### Patch Changes

- Updated dependencies [19efbcf]
  - @shopify/liquid-language-server-common@1.2.0

## 1.1.0

### Minor Changes

- a35a0b1: Add Basic TextDocumentSync + PublishDiagnostic support

### Patch Changes

- Updated dependencies [a35a0b1]
  - @shopify/liquid-language-server-common@1.1.0

## 1.0.0

### Major Changes

- ed0e93e: Initial release

### Patch Changes

- Updated dependencies [ed0e93e]
  - @shopify/liquid-language-server-common@1.0.0
