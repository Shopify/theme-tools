# @shopify/liquid-language-server-common

## 1.7.0

### Minor Changes

- a395141: Add HtmlAttributeValueCompletionProvider
- 5669466: Implemented `fileSize` dependency to enable asset size checks
- a395141: Add documentation on hover for intelligent code completion

### Patch Changes

- Updated dependencies [95abccc]
- Updated dependencies [95abccc]
- Updated dependencies [1dc7848]
- Updated dependencies [95abccc]
- Updated dependencies [95abccc]
  - @shopify/theme-check-common@1.12.0

## 1.6.0

### Minor Changes

- 8f2270f: Fixed: type of docset entry data rendered
- 6bad30d: Introduce Intelligent Code Completion foundations + Liquid tags completion provider
- 57f28a6: Bump `@shopify/theme-check-common` to v1.9.0

### Patch Changes

- f369925: Add ObjectCompletionProvider

## 1.5.0

### Minor Changes

- 57f28a6: Bump `@shopify/theme-check-common` to v1.9.0

## 1.4.1

### Patch Changes

- 28c8f88: Bump theme-check-common to v1.7.1

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

## 1.3.3

### Patch Changes

- 81ec8c2: Normalize paths and URIs across platforms

## 1.3.2

### Patch Changes

- d16de84: Bump theme-check-common to v1.5.1

## 1.3.1

### Patch Changes

- d63cadb: Bump theme-check-common to v1.4.1

## 1.3.0

### Minor Changes

- 6f5c92c: Start listening for workspace/did{Create,Rename,Delete}Files notifications
- Bump @shopify/theme-check-common to v1.4.0

  - Adds new check: `TranslationKeyExists`

## 1.2.2

### Patch Changes

- Use buffer value of default translations before the injected value

## 1.2.1

### Patch Changes

- d4682a6: Reexport theme-check-common interfaces

## 1.2.0

### Minor Changes

- 19efbcf: Bump theme-check to v1.2.0

  - Adds MatchingTranslations check
  - Adds `{% # theme-check-disable %}`

## 1.1.0

### Minor Changes

- a35a0b1: Add Basic TextDocumentSync + PublishDiagnostic support

## 1.0.0

### Major Changes

- ed0e93e: Initial release
