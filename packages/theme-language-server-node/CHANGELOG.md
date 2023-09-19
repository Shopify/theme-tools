# @shopify/theme-language-server-node

# @shopify/liquid-language-server-node

## 1.7.1

### Patch Changes

- e8d569d: Subscribe to open/close notifications
- Updated dependencies [e8d569d]
  - @shopify/liquid-language-server-common@1.7.1
  - @shopify/theme-check-docs-updater@1.12.1

## 1.7.0

### Minor Changes

- 5ba20bd: Implemented `fileSize` dependency to enable asset size checks

### Patch Changes

- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
  - @shopify/liquid-language-server-common@1.7.0
  - @shopify/theme-check-docs-updater@1.12.0

## 1.6.0

### Minor Changes

- 8f2270f: Fixed: type of docset entry data rendered
- 4f69932: Bumped @shopify/theme-check-docs-updater@^1.11.1
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
