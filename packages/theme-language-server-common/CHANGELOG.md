# @shopify/theme-language-server-common

## 1.5.1

### Patch Changes

- 79b0549: Add `app` object support for theme app extensions
- Updated dependencies [79b0549]
- Updated dependencies [ac1deb4]
  - @shopify/theme-check-common@1.20.1

## 1.5.0

### Minor Changes

- 78813ea: Add hover and completion support for theme, section and block settings

### Patch Changes

- 78813ea: Fix root finding for theme app extensions without a config file
- Updated dependencies [78813ea]
  - @shopify/liquid-html-parser@1.1.1
  - @shopify/theme-check-common@1.20.0

## 1.4.6

### Patch Changes

- Updated dependencies [d9f3063]
  - @shopify/theme-check-common@1.19.0

## 1.4.5

### Patch Changes

- Updated dependencies [fe54680]
- Updated dependencies [e00c319]
  - @shopify/theme-check-common@1.18.2

## 1.4.4

### Patch Changes

- aa33c5f: Fix hover, completion and `UndefinedObject` reporting of `{% increment var %}` and `{% decrement var %}`
- Updated dependencies [0d71145]
- Updated dependencies [aa33c5f]
- Updated dependencies [0d71145]
  - @shopify/liquid-html-parser@1.1.0
  - @shopify/theme-check-common@1.18.1

## 1.4.3

### Patch Changes

- dacdd9f: Add blocks/ files contextual completion, hover and UndefinedObject support
- Updated dependencies [96d4d5e]
- Updated dependencies [dacdd9f]
  - @shopify/theme-check-common@1.18.0

## 1.4.2

### Patch Changes

- dbd5fb0: Fix document links and translation reporting for setups with custom root

## 1.4.1

### Patch Changes

- 54a9075: Revert the detail info in completion items, this causes weird things in VS Code

## 1.4.0

### Minor Changes

- b27d8c7: Fixed type definition of fileSize

### Patch Changes

- 23c84af: Change the completion item label for translation keys to include the quotes and translation filter
- 73a65e0: Add `detail` info to Liquid Completion Items

## 1.3.3

### Patch Changes

- Updated dependencies [2cf7a11]
- Updated dependencies [2cf7a11]
  - @shopify/theme-check-common@1.17.0

## 1.3.2

### Patch Changes

- 8d35241: Fix `paginate` object completion, hover and `UndefinedObject` reporting
- 201f30c: Add support for `{% layout none %}`
- c0298e7: Fix `recommendations` completion, hover and `UndefinedObject` reporting
- 6fad756: Fix `predictive_search` completion, hover and `UndefinedObject` reporting
- fc86c91: Fix `form` object completion, hover and `UndefinedObject` reporting
- Updated dependencies [8d35241]
- Updated dependencies [201f30c]
- Updated dependencies [c0298e7]
- Updated dependencies [6fad756]
- Updated dependencies [fc86c91]
  - @shopify/theme-check-common@1.16.1

## 1.3.1

### Patch Changes

- f35feb4: Fix available objects list of completion provider
- d71a5e2: Fix completion, hover and UndefinedObject reporting of tablerowloop and forloop variables
- Updated dependencies [279a464]
- Updated dependencies [d71a5e2]
  - @shopify/theme-check-common@1.16.0

## 1.3.0

### Minor Changes

- eb630b1: Add Shopify Reference links at the bottom of Liquid Hover and Completion items

### Patch Changes

- Updated dependencies [6c2c00f]
- Updated dependencies [f1a642f]
  - @shopify/theme-check-common@1.15.0

## 1.2.1

### Patch Changes

- Updated dependencies [b7514f4]
  - @shopify/theme-check-common@1.14.1

## 1.2.0

### Minor Changes

- 380b273: Add `RenderSnippetCompletionProvider`

### Patch Changes

- Updated dependencies [beeb85f]
- Updated dependencies [a05aebb]
  - @shopify/theme-check-common@1.14.0

## 1.1.0

### Minor Changes

- 7457f2c: Add `TranslationCompletionProvider`
- 7457f2c: Add `TranslationHoverProvider`

## 1.0.2

## 1.0.1

### Patch Changes

- 14b9ee2: Fixup package.json configs
- Updated dependencies [14b9ee2]
  - @shopify/theme-check-common@1.13.1

## 1.0.0

### Major Changes

- 319bcf1: `@shopify/theme-language-server` initial release

### Minor Changes

- 25b79f0: Rename LiquidDrop -> LiquidVariableLookup
- acfac68: Rename `liquid-language-server-*` packages to `theme-language-server-*`

### Patch Changes

- 8cd0b54: Fix hover support for section objects
- f3cda64: Fixup LSP linting non LiquidHTML | JSON files
- 4bb4b8d: Fixup `end*` Liquid tag completion
- Updated dependencies [441a8c5]
- Updated dependencies [c00e929]
- Updated dependencies [972c26c]
- Updated dependencies [25b79f0]
- Updated dependencies [f3cda64]
- Updated dependencies [b1b8366]
- Updated dependencies [02f4731]
- Updated dependencies [c00e929]
- Updated dependencies [c00e929]
- Updated dependencies [12c794a]
- Updated dependencies [b1b8366]
- Updated dependencies [b1b8366]
- Updated dependencies [c00e929]
  - @shopify/theme-check-common@1.13.0
  - @shopify/liquid-html-parser@1.0.0

# @shopify/liquid-language-server-common

## 1.7.1

### Patch Changes

- e8d569d: Subscribe to open/close notifications
- Updated dependencies
- Updated dependencies [5479a63]
- Updated dependencies [5479a63]
  - @shopify/theme-check-common@1.12.1
  - @shopify/prettier-plugin-liquid@1.2.3

## 1.7.0

### Minor Changes

- 5ba20bd: Add HtmlAttributeValueCompletionProvider
- 5ba20bd: Implemented `fileSize` dependency to enable asset size checks
- 5ba20bd: Add documentation on hover for intelligent code completion

### Patch Changes

- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
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
