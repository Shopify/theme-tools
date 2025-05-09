# @shopify/theme-language-server-browser

## 2.15.2

### Patch Changes

- @shopify/theme-language-server-common@2.15.2

## 2.15.1

### Patch Changes

- @shopify/theme-language-server-common@2.15.1

## 2.15.0

### Patch Changes

- Updated dependencies [4d2a2bac]
- Updated dependencies [37d7b2f3]
- Updated dependencies [1142ffea]
- Updated dependencies [a1fa7376]
- Updated dependencies [19f5589b]
- Updated dependencies [90577cd2]
- Updated dependencies [ea6440ab]
  - @shopify/theme-language-server-common@2.15.0

## 2.14.1

### Patch Changes

- @shopify/theme-language-server-common@2.14.1

## 2.14.0

### Patch Changes

- Updated dependencies [067a75eb]
- Updated dependencies [aa43656b]
- Updated dependencies [a126ab54]
  - @shopify/theme-language-server-common@2.14.0

## 2.13.2

### Patch Changes

- Updated dependencies [d1171049]
  - @shopify/theme-language-server-common@2.13.2

## 2.13.1

### Patch Changes

- @shopify/theme-language-server-common@2.13.1

## 2.13.0

### Patch Changes

- Updated dependencies [e75f896d]
  - @shopify/theme-language-server-common@2.13.0

## 2.12.1

### Patch Changes

- Updated dependencies [7ff54f02]
  - @shopify/theme-language-server-common@2.12.1

## 2.12.0

### Patch Changes

- Updated dependencies [1a95a190]
- Updated dependencies [44233c4f]
- Updated dependencies [52b3d2c9]
- Updated dependencies [886ee4b1]
  - @shopify/theme-language-server-common@2.12.0

## 2.11.0

### Patch Changes

- d9b58157: Make theme preload fs.readFile error resilient
- Updated dependencies [d42ed610]
- Updated dependencies [d9b58157]
- Updated dependencies [86f2c25e]
- Updated dependencies [ea9f2451]
- Updated dependencies [6268e838]
  - @shopify/theme-language-server-common@2.11.0

## 2.10.1

### Patch Changes

- Updated dependencies [9ffbe27d]
  - @shopify/theme-language-server-common@2.10.1

## 2.10.0

### Patch Changes

- Updated dependencies [110bb005]
- Updated dependencies [3a68fe5f]
- Updated dependencies [1dc03172]
- Updated dependencies [d9fc9d03]
- Updated dependencies [dafba833]
- Updated dependencies [cb2b2f45]
- Updated dependencies [17cf30de]
- Updated dependencies [85579bcb]
- Updated dependencies [22dd956a]
  - @shopify/theme-language-server-common@2.10.0

## 2.9.1

### Patch Changes

- Updated dependencies [754f7f66]
- Updated dependencies [8be77897]
  - @shopify/theme-language-server-common@2.9.1

## 2.9.0

### Patch Changes

- Updated dependencies [f077a9ec]
  - @shopify/theme-language-server-common@2.9.0

## 2.8.0

### Patch Changes

- Updated dependencies [2e4613b8]
- Updated dependencies [d9dbc265]
- Updated dependencies [e3e1dfdf]
- Updated dependencies [e9c1d98a]
- Updated dependencies [2db3047f]
- Updated dependencies [261c2958]
- Updated dependencies [5eaf2950]
  - @shopify/theme-language-server-common@2.8.0

## 2.7.0

### Patch Changes

- Updated dependencies [2ef93d17]
- Updated dependencies [5312283e]
- Updated dependencies [77c2536f]
  - @shopify/theme-language-server-common@2.7.0

## 2.6.1

### Patch Changes

- 841ca6d1: Update repository URL for all packages to be case sensitive
- Updated dependencies [841ca6d1]
  - @shopify/theme-language-server-common@2.6.1

## 2.6.0

### Patch Changes

- Updated dependencies [c85a6131]
- Updated dependencies [931dc9b9]
- Updated dependencies [02b8967f]
- Updated dependencies [9765bece]
- Updated dependencies [dd0cd4d2]
  - @shopify/theme-language-server-common@2.6.0

## 2.5.0

### Patch Changes

- Updated dependencies [ccc0c952]
- Updated dependencies [ac55577a]
  - @shopify/theme-language-server-common@2.5.0

## 2.4.0

### Patch Changes

- Updated dependencies [68e1b44b]
- Updated dependencies [dc9c6da6]
- Updated dependencies [c60e61ba]
- Updated dependencies [4a429e15]
- Updated dependencies [68e1b44b]
- Updated dependencies [c74850c8]
- Updated dependencies [b31e0f85]
  - @shopify/theme-language-server-common@2.4.0

## 2.3.3

### Patch Changes

- @shopify/theme-language-server-common@2.3.3

## 2.3.2

### Patch Changes

- Updated dependencies [2bd19d66]
  - @shopify/theme-language-server-common@2.3.2

## 2.3.1

### Patch Changes

- @shopify/theme-language-server-common@2.3.1

## 2.3.0

### Patch Changes

- Updated dependencies [d1658353]
- Updated dependencies [528127bd]
- Updated dependencies [4b2dec31]
- Updated dependencies [b2bad1f4]
- Updated dependencies [2228b3d9]
- Updated dependencies [05b928ea]
- Updated dependencies [b2bad1f4]
- Updated dependencies [5916a6ec]
  - @shopify/theme-language-server-common@2.3.0

## 2.2.2

### Patch Changes

- @shopify/theme-language-server-common@2.2.2

## 2.2.1

### Patch Changes

- @shopify/theme-language-server-common@2.2.1

## 2.2.0

### Patch Changes

- Updated dependencies [add2445]
- Updated dependencies [f09c923]
- Updated dependencies [0b7534b]
- Updated dependencies [9a07208]
  - @shopify/theme-language-server-common@2.2.0

## 2.1.0

### Patch Changes

- Updated dependencies [b431db7]
- Updated dependencies [04a3275]
- Updated dependencies [8f3bc18]
- Updated dependencies [568d53b]
- Updated dependencies [6014dfd]
  - @shopify/theme-language-server-common@2.1.0

## 2.0.0

### Major Changes

- 4b574c1: [Breaking] Replace fs-based dependency injection by an AbstractFileSystem injection

  ```diff
  + class FileSystemImpl implements AbstractFileSystem {
  +   /* ... */
  + }

  startServer(worker, {
  - findRootURI,
  - fileExists,
  - fileSize,
  - getDefaultTranslationsFactory,
  - getDefaultLocaleFactory,
  - getDefaultSchemaTranslationsFactory,
  - getDefaultSchemaLocaleFactory,
  - getThemeSettingsSchemaForRootURI,
  + fs: new FileSystemImpl(),
    loadConfig,
    log,
    themeDocset,
    jsonValidationSet,
  })
  ```

- 4b574c1: Expose language server connection in Public API

  This lets you send non-standard LSP messages to the client.

  ```ts
  import {
    getConnection,
    startServer,
    AbstractFileSystem,
  } from '@shopify/theme-language-server-browser';

  class MainThreadFileSystem implements AbstractFileSystem {
    constructor(private connection) {}
    readFile(uri) {
      return this.connection.sendRequest('fs/readFile', uri);
    }
    readDirectory(uri) {
      return this.connection.sendRequest('fs/readDirectory', uri);
    }
    readFile(uri) {
      return this.connection.sendRequest('fs/stat', uri);
    }
  }

  const worker = self as any as Worker;
  const connection = getConnection(worker);
  const fs = new MainThreadFileSystem(connection);
  const dependencies = {
    /* ... */
  };

  startServer(worker, dependencies, connection);
  ```

### Patch Changes

- Updated dependencies [5fab0e9]
- Updated dependencies [4b574c1]
- Updated dependencies [5fab0e9]
- Updated dependencies [4b574c1]
  - @shopify/theme-language-server-common@2.0.0

## 1.14.0

### Patch Changes

- Updated dependencies [a0ba46d]
- Updated dependencies [e36ed42]
- Updated dependencies [9bff5bd]
  - @shopify/theme-language-server-common@1.14.0

## 1.13.1

### Patch Changes

- Updated dependencies [c664d52]
  - @shopify/theme-language-server-common@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [28a5d31]
- Updated dependencies [b5a2fbc]
- Updated dependencies [474b859]
- Updated dependencies [264321f]
- Updated dependencies [d1f9fef]
- Updated dependencies [f0f9ec2]
- Updated dependencies [a946a4e]
- Updated dependencies [f96425e]
  - @shopify/theme-language-server-common@1.13.0

## 1.12.1

### Patch Changes

- @shopify/theme-language-server-common@1.12.1

## 1.12.0

### Patch Changes

- Updated dependencies [d7c6204]
  - @shopify/theme-language-server-common@1.12.0

## 1.11.3

### Patch Changes

- @shopify/theme-language-server-common@1.11.3

## 1.11.2

### Patch Changes

- @shopify/theme-language-server-common@1.11.2

## 1.11.1

### Patch Changes

- Updated dependencies [ec1fbd7]
  - @shopify/theme-language-server-common@1.11.1

## 1.11.0

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
  - @shopify/theme-language-server-common@1.11.0

## 1.10.0

### Minor Changes

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
  - @shopify/theme-language-server-common@1.10.0

## 1.9.0

### Patch Changes

- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-language-server-common@1.9.0

## 1.8.3

### Patch Changes

- @shopify/theme-language-server-common@1.8.3

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
