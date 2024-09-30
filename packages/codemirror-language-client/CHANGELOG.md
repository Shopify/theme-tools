# @shopify/codemirror-language-client

## 0.6.0

### Minor Changes

- 42c76d9: Add support for LSP Document Highlight requests

## 0.5.1

### Patch Changes

- 8e3c7e2: Breaking: add `getDefaultSchema{Locale,Translations}(Factory)?` dependencies

  To be used to power `MatchingTranslations` for [Schema translations](https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files).

  To be used to power Schema translations code completion and hover in section and theme block `{% schema %}` JSON blobs.

## 0.5.0

### Minor Changes

- d91e2e3: Add snippet completion support

### Patch Changes

- d91e2e3: Respect the trigger characters server capability
- d91e2e3: Add completion context to the completion requests

## 0.4.0

### Minor Changes

- a9ed3d7: Add `CompletionList` return type support in completion handler

## 0.3.1

### Patch Changes

- 8451075: `package.json` and README cleanups

## 0.3.0

### Minor Changes

- 16a3707: Add LSP Hover support

## 0.2.0

### Minor Changes

- 73a65e0: Add `{ shouldLint, shouldComplete }` optional params to CodeMirrorLanguageClient's .extension method

  - This way linting and completions become optional features that can be turned off / experimented on

- 0ca7963: Add `diagnosticRenderer` and option overrides to public API of CodeMirrorLanguageClient
- 73a65e0: Add Completion Support

## 0.1.0

### Minor Changes

- 962adac: Hello world

# @shopify/code-mirror-language-client (private)

## 0.0.7

### Patch Changes

- Squiggly line mistery-final.psd

## 0.0.6

### Patch Changes

- Squiggly line mistery resolution: bazooka edition

## 0.0.5

### Patch Changes

- Fix squiggly line disappearing on odd user interactions

## 0.0.4

### Patch Changes

- Unhardcode the logger

## 0.0.3

### Patch Changes

- Split output into UMD & ESM for webpack/jest support

## 0.0.2

### Patch Changes

- Fix ghost diagnostics issue with linter#needsRefresh

## 0.0.1

### Patch Changes

- 36158bb: Initial release
