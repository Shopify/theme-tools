# @shopify/theme-check-docs-updater

## 2.9.0

### Patch Changes

- Updated dependencies [457f9cb]
- Updated dependencies [edb7f2e]
  - @shopify/theme-check-common@2.9.0

## 2.7.0

### Patch Changes

- Updated dependencies [bb79d83]
  - @shopify/theme-check-common@2.7.0

## 2.6.0

### Patch Changes

- Updated dependencies [ff78229]
  - @shopify/theme-check-common@2.6.0

## 2.5.1

### Patch Changes

- 312d804: Add logging support to the docs loader
- Updated dependencies [ec1fbd7]
  - @shopify/theme-check-common@2.5.1

## 2.5.0

### Minor Changes

- 03b41e1: Breaking: `jsonValidationSet`'s schemas public API change

  Now takes a function of the following signature:

  ```ts
  interface JsonValidationSet = {
    schemas: (context: 'theme' | 'app') => Promise<SchemaDefinition[]>
  }
  ```

  Reason being we want to support `fileMatch` overloading of `blocks/*.liquid` files and we needed a way to identify which context you're in.

  Unfortunately, the JSON schema for `blocks/*.liquid` files in theme app extensions isn't the same one we have in themes. There doesn't seem to be a way to unify them either.

- 03b41e1: Add support for the schemas manifest on Shopify/theme-liquid-docs

  Shopify/theme-liquid-docs now supports composable JSON schemas (with relative paths). To solve the `blocks/*.liquid` file match JSON schema overload depending on the context (`app` or `theme`), we defined two manifests that describe the schemas required by your solution and define the fileMatch rules:

  - [manifest_theme.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)
  - [manifest_theme_app_extension.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)

  `@shopify/theme-check-docs-updater` now reads those manifests and downloads the tree of dependency that they require. We will no longer need to make new theme-tools releases whenever we add new schemas. We'll be able to dev them and their file associations directly from Shopify/theme-liquid-docs and have downstream consumers updated automatically (the same way docs are automatically updated).

### Patch Changes

- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
  - @shopify/theme-check-common@2.5.0

## 2.4.0

### Minor Changes

- 767d223: Breaking: Removes compile-schema command
- 767d223: Breaking: Redesign `jsonValidationSet` public API

  (Only breaking for in-browser packages, node packages are still batteries-included)

  Before:

  ```ts
  type JsonValidationSet = {
    sectionSchema(): Promise<string>;
    translationSchema(): Promise<string>;
    validateSectionSchema(): Promise<ValidateFunction>;
  };
  ```

  After:

  ```ts
  type URI = string;

  type SchemaDefinition = {
    uri: string;
    fileMatch?: string[];
    schema: Promise<string>;
  };

  type JsonValidationSet = {
    schemas: SchemaDefinition[];
  };
  ```

  We’re getting rid of [ajv](https://ajv.js.org/) and we’ll use [vscode-json-languageservice](https://github.com/microsoft/vscode-json-languageservice) in Theme Check instead. That dependency is required by the language server anyway, might as well reuse it instead of depending on a totally different solution for validation. We'll also get better reporting of Syntax Errors because the parser used by `vscode-json-languageservice` is better.

  Moreover, this new design leaves space for `$ref` support.

### Patch Changes

- Updated dependencies [767d223]
- Updated dependencies [767d223]
  - @shopify/theme-check-common@2.4.0

## 2.3.0

### Patch Changes

- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-check-common@2.3.0

## 2.2.2

### Patch Changes

- @shopify/theme-check-common@2.2.2

## 2.2.1

### Patch Changes

- Updated dependencies [8710bde]
  - @shopify/theme-check-common@2.2.1

## 2.2.0

### Patch Changes

- @shopify/theme-check-common@2.2.0

## 2.1.0

### Minor Changes

- 042f1e0: Breaking: internal rename of `schemaValidators` to `jsonValidationSet`

  This breaks the browser dependencies public API (for `startServer` and `runChecks`) and will thus require some code changes in those contexts.

  The node packages absorb the dependency injection and are not breaking.

### Patch Changes

- Updated dependencies [042f1e0]
- Updated dependencies [a9ae65f]
  - @shopify/theme-check-common@2.1.0

## 2.0.4

### Patch Changes

- 84f9eda: Include docset fallbacks in the theme-check-docs-updater package

  For when a user’s Internet connection is down or https://raw.githubusercontent.com is not accessible.

  - @shopify/theme-check-common@2.0.4

## 2.0.3

### Patch Changes

- @shopify/theme-check-common@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/theme-check-common@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [8f19b87]
  - @shopify/theme-check-common@2.0.1

## 2.0.0

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
- Updated dependencies [8451075]
  - @shopify/theme-check-common@2.0.0

## 1.22.0

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [aeb9b3f]
  - @shopify/theme-check-common@1.22.0

## 1.21.0

### Minor Changes

- 772a1ce: Update `translation-key-exists` check and intelligent code completion to always stay up-to-date with Shopify translation keys

### Patch Changes

- Updated dependencies [772a1ce]
- Updated dependencies [b05a6a8]
  - @shopify/theme-check-common@1.21.0

## 1.20.1

### Patch Changes

- Updated dependencies [79b0549]
- Updated dependencies [ac1deb4]
  - @shopify/theme-check-common@1.20.1

## 1.20.0

### Patch Changes

- @shopify/theme-check-common@1.20.0

## 1.19.0

### Patch Changes

- Updated dependencies [d9f3063]
  - @shopify/theme-check-common@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [fe54680]
- Updated dependencies [e00c319]
  - @shopify/theme-check-common@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [aa33c5f]
- Updated dependencies [0d71145]
  - @shopify/theme-check-common@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [96d4d5e]
- Updated dependencies [dacdd9f]
  - @shopify/theme-check-common@1.18.0

## 1.17.0

### Patch Changes

- Updated dependencies [2cf7a11]
- Updated dependencies [2cf7a11]
  - @shopify/theme-check-common@1.17.0

## 1.16.1

### Patch Changes

- Updated dependencies [8d35241]
- Updated dependencies [201f30c]
- Updated dependencies [c0298e7]
- Updated dependencies [6fad756]
- Updated dependencies [fc86c91]
  - @shopify/theme-check-common@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [279a464]
- Updated dependencies [d71a5e2]
  - @shopify/theme-check-common@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [6c2c00f]
- Updated dependencies [f1a642f]
  - @shopify/theme-check-common@1.15.0

## 1.14.1

### Patch Changes

- Updated dependencies [b7514f4]
  - @shopify/theme-check-common@1.14.1

## 1.14.0

### Patch Changes

- Updated dependencies [beeb85f]
- Updated dependencies [a05aebb]
  - @shopify/theme-check-common@1.14.0

## 1.13.1

### Patch Changes

- Updated dependencies [14b9ee2]
  - @shopify/theme-check-common@1.13.1

## 1.13.0

### Minor Changes

- 12c794a: Add `DeprecatedTags` check

### Patch Changes

- c00e929: Bug fix for `AssetSizeCSS`: Fixes redundant messages.
- c00e929: Bug fix for `AssetSizeAppBlockCSS`: Corrects underlining issues.
- c00e929: Bug fix for `AssetUrlFilters`: Reports better messaging.
- c00e929: Bug fix for `AssetSizeAppBlockJavascript`: Corrects underlining issues.
- Updated dependencies [441a8c5]
- Updated dependencies [c00e929]
- Updated dependencies [972c26c]
- Updated dependencies [25b79f0]
- Updated dependencies [f3cda64]
- Updated dependencies [b1b8366]
- Updated dependencies [c00e929]
- Updated dependencies [c00e929]
- Updated dependencies [12c794a]
- Updated dependencies [b1b8366]
- Updated dependencies [b1b8366]
- Updated dependencies [c00e929]
  - @shopify/theme-check-common@1.13.0

## 1.12.1

### Patch Changes

- Updated dependencies
  - @shopify/theme-check-common@1.12.1

## 1.12.0

### Minor Changes

- 5ba20bd: Fixed bug for `AssetUrlFilters` check
- 5ba20bd: Add `ContentForHeaderModification` check
- 5ba20bd: Add `AssetSizeCSS` check
- 5ba20bd: Add `AssetSizeAppBlockCSS` check

### Patch Changes

- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
- Updated dependencies [5ba20bd]
  - @shopify/theme-check-common@1.12.0

## 1.11.1

### Patch Changes

- Updated dependencies [2e73166]
  - @shopify/theme-check-common@1.11.1

## 1.11.0

### Minor Changes

- e67a16d: Breaking: Dependency injected json schema validators

### Patch Changes

- Updated dependencies [e67a16d]
  - @shopify/theme-check-common@1.11.0

## 1.10.0

### Patch Changes

- Updated dependencies [4db7c7e]
- Updated dependencies [a94f23c]
  - @shopify/theme-check-common@1.10.0
