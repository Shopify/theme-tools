# @shopify/theme-language-server-node

## 2.3.3

### Patch Changes

- Updated dependencies [d7436b4a]
- Updated dependencies [6f1862c8]
  - @shopify/theme-check-node@3.5.0
  - @shopify/theme-language-server-common@2.3.3
  - @shopify/theme-check-docs-updater@3.5.0

## 2.3.2

### Patch Changes

- Updated dependencies [2bd19d66]
  - @shopify/theme-language-server-common@2.3.2

## 2.3.1

### Patch Changes

- @shopify/theme-check-node@3.4.0
- @shopify/theme-language-server-common@2.3.1
- @shopify/theme-check-docs-updater@3.4.0

## 2.3.0

### Patch Changes

- Updated dependencies [05ae5ea8]
- Updated dependencies [d1658353]
- Updated dependencies [528127bd]
- Updated dependencies [26215724]
- Updated dependencies [73758ba1]
- Updated dependencies [5e8a2bfe]
- Updated dependencies [4b2dec31]
- Updated dependencies [b2bad1f4]
- Updated dependencies [2228b3d9]
- Updated dependencies [05b928ea]
- Updated dependencies [1083b2bc]
- Updated dependencies [b2bad1f4]
- Updated dependencies [5916a6ec]
  - @shopify/theme-check-node@3.3.0
  - @shopify/theme-language-server-common@2.3.0
  - @shopify/theme-check-docs-updater@3.3.0

## 2.2.2

### Patch Changes

- @shopify/theme-check-node@3.2.2
- @shopify/theme-language-server-common@2.2.2
- @shopify/theme-check-docs-updater@3.2.2

## 2.2.1

### Patch Changes

- Updated dependencies [4a18a78]
  - @shopify/theme-check-node@3.2.1
  - @shopify/theme-language-server-common@2.2.1
  - @shopify/theme-check-docs-updater@3.2.1

## 2.2.0

### Patch Changes

- Updated dependencies [3f7680e]
- Updated dependencies [add2445]
- Updated dependencies [f09c923]
- Updated dependencies [0b7534b]
- Updated dependencies [8a0bf78]
- Updated dependencies [7a6dfe8]
- Updated dependencies [c4813ff]
- Updated dependencies [9a07208]
- Updated dependencies [f09c923]
  - @shopify/theme-check-node@3.2.0
  - @shopify/theme-language-server-common@2.2.0
  - @shopify/theme-check-docs-updater@3.2.0

## 2.1.0

### Patch Changes

- Updated dependencies [b431db7]
- Updated dependencies [04a3275]
- Updated dependencies [568d53b]
- Updated dependencies [8f3bc18]
- Updated dependencies [568d53b]
- Updated dependencies [6014dfd]
  - @shopify/theme-language-server-common@2.1.0
  - @shopify/theme-check-node@3.1.0
  - @shopify/theme-check-docs-updater@3.1.0

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
- Updated dependencies [4b574c1]
  - @shopify/theme-language-server-common@2.0.0
  - @shopify/theme-check-node@3.0.0
  - @shopify/theme-check-docs-updater@3.0.0

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
  - @shopify/theme-check-node@2.9.2
  - @shopify/theme-check-docs-updater@2.9.2

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
  - @shopify/theme-check-node@2.9.1
  - @shopify/theme-check-docs-updater@2.9.1

## 1.12.1

### Patch Changes

- Updated dependencies [457f9cb]
  - @shopify/theme-check-node@2.9.0
  - @shopify/theme-language-server-common@1.12.1
  - @shopify/theme-check-docs-updater@2.9.0

## 1.12.0

### Patch Changes

- Updated dependencies [d7c6204]
  - @shopify/theme-language-server-common@1.12.0

## 1.11.3

### Patch Changes

- Updated dependencies [bb79d83]
  - @shopify/theme-check-node@2.7.0
  - @shopify/theme-language-server-common@1.11.3
  - @shopify/theme-check-docs-updater@2.7.0

## 1.11.2

### Patch Changes

- @shopify/theme-check-node@2.6.0
- @shopify/theme-language-server-common@1.11.2
- @shopify/theme-check-docs-updater@2.6.0

## 1.11.1

### Patch Changes

- Updated dependencies [ec1fbd7]
- Updated dependencies [0dc03a9]
- Updated dependencies [312d804]
  - @shopify/theme-language-server-common@1.11.1
  - @shopify/theme-check-node@2.5.1
  - @shopify/theme-check-docs-updater@2.5.1

## 1.11.0

### Minor Changes

- e0031bb: Fix Theme App Extension context inference
- 03b41e1: Breaking: `jsonValidationSet`'s schemas public API change

  Now takes a function of the following signature:

  ```ts
  interface JsonValidationSet = {
    schemas: (context: 'theme' | 'app') => Promise<SchemaDefinition[]>
  }
  ```

  Reason being we want to support `fileMatch` overloading of `blocks/*.liquid` files and we needed a way to identify which context you're in.

  Unfortunately, the JSON schema for `blocks/*.liquid` files in theme app extensions isn't the same one we have in themes. There doesn't seem to be a way to unify them either.

### Patch Changes

- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
  - @shopify/theme-language-server-common@1.11.0
  - @shopify/theme-check-docs-updater@2.5.0
  - @shopify/theme-check-node@2.5.0

## 1.10.0

### Patch Changes

- Updated dependencies [767d223]
- Updated dependencies [767d223]
  - @shopify/theme-check-docs-updater@2.4.0
  - @shopify/theme-language-server-common@1.10.0
  - @shopify/theme-check-node@2.4.0

## 1.9.0

### Minor Changes

- 8e3c7e2: Make translation completion fuzzy
- 8e3c7e2: Breaking: add `getDefaultSchema{Locale,Translations}(Factory)?` dependencies

  To be used to power `MatchingTranslations` for [Schema translations](https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files).

  To be used to power Schema translations code completion and hover in section and theme block `{% schema %}` JSON blobs.

### Patch Changes

- 8e3c7e2: Theme translation completion now appends parameters

  For example, if your translation look like this:

  ```json
  {
    "items": {
      "one": "{{ count }} item",
      "other": "{{ count }} items"
    }
  }
  ```

  Then we’ll complete like this:

  ```liquid
  {{ 'items' | t: count: count }}
  ```

- 8e3c7e2: Unify parseJSON usage
- 8e3c7e2: Fix offering of standard translations options when the default translation file is open
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-language-server-common@1.9.0
  - @shopify/theme-check-node@2.3.0
  - @shopify/theme-check-docs-updater@2.3.0

## 1.8.3

### Patch Changes

- Updated dependencies [08ca661]
  - @shopify/theme-check-node@2.2.2
  - @shopify/theme-check-docs-updater@2.2.2
  - @shopify/theme-language-server-common@1.8.3

## 1.8.2

### Patch Changes

- @shopify/theme-check-node@2.2.1
- @shopify/theme-language-server-common@1.8.2
- @shopify/theme-check-docs-updater@2.2.1

## 1.8.1

### Patch Changes

- d66d49c: Improve root finding of theme app extensions and zipped themes

  Folders for which all the following is true are considered a root:

  - have a `snippets/` folder, and
  - don't have a `../.theme-check.yml`,
  - don't have a `../../.theme-check.yml`.

  No config file or `.git` folder required.

- d66d49c: Unify root finding algorithm for node LS and TC packages
- Updated dependencies [d66d49c]
- Updated dependencies [d66d49c]
- Updated dependencies [d66d49c]
  - @shopify/theme-check-node@2.2.0
  - @shopify/theme-language-server-common@1.8.1
  - @shopify/theme-check-docs-updater@2.2.0

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
- Updated dependencies [402f151]
- Updated dependencies [042f1e0]
- Updated dependencies [a9ae65f]
  - @shopify/theme-language-server-common@1.8.0
  - @shopify/theme-check-docs-updater@2.1.0
  - @shopify/theme-check-node@2.1.0

## 1.7.7

### Patch Changes

- Updated dependencies [84f9eda]
  - @shopify/theme-check-docs-updater@2.0.4
  - @shopify/theme-check-node@2.0.4
  - @shopify/theme-language-server-common@1.7.7

## 1.7.6

### Patch Changes

- Updated dependencies [e5022ee]
  - @shopify/theme-check-node@2.0.3
  - @shopify/theme-check-docs-updater@2.0.3
  - @shopify/theme-language-server-common@1.7.6

## 1.7.5

### Patch Changes

- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/theme-check-node@2.0.2
  - @shopify/theme-language-server-common@1.7.5
  - @shopify/theme-check-docs-updater@2.0.2

## 1.7.4

### Patch Changes

- @shopify/theme-check-node@2.0.1
- @shopify/theme-language-server-common@1.7.4
- @shopify/theme-check-docs-updater@2.0.1

## 1.7.3

### Patch Changes

- Updated dependencies [7459e14]
  - @shopify/theme-language-server-common@1.7.3

## 1.7.2

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
- Updated dependencies [8451075]
  - @shopify/theme-check-node@2.0.0
  - @shopify/theme-language-server-common@1.7.2
  - @shopify/theme-check-docs-updater@2.0.0

## 1.7.1

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [aeb9b3f]
  - @shopify/theme-check-node@1.22.0
  - @shopify/theme-language-server-common@1.7.1
  - @shopify/theme-check-docs-updater@1.22.0

## 1.7.0

### Patch Changes

- Updated dependencies [772a1ce]
- Updated dependencies [b05a6a8]
  - @shopify/theme-language-server-common@1.7.0
  - @shopify/theme-check-docs-updater@1.21.0
  - @shopify/theme-check-node@1.21.0

## 1.6.0

### Patch Changes

- Updated dependencies [a120393]
  - @shopify/theme-language-server-common@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [79b0549]
  - @shopify/theme-language-server-common@1.5.1
  - @shopify/theme-check-node@1.20.1
  - @shopify/theme-check-docs-updater@1.20.1

## 1.5.0

### Minor Changes

- 78813ea: Add hover and completion support for theme, section and block settings

### Patch Changes

- 78813ea: Fix root finding for theme app extensions without a config file
- Updated dependencies [78813ea]
- Updated dependencies [78813ea]
- Updated dependencies [78813ea]
  - @shopify/theme-language-server-common@1.5.0
  - @shopify/theme-check-node@1.20.0
  - @shopify/theme-check-docs-updater@1.20.0

## 1.4.6

### Patch Changes

- @shopify/theme-check-node@1.19.0
- @shopify/theme-language-server-common@1.4.6
- @shopify/theme-check-docs-updater@1.19.0

## 1.4.5

### Patch Changes

- @shopify/theme-check-node@1.18.2
- @shopify/theme-language-server-common@1.4.5
- @shopify/theme-check-docs-updater@1.18.2

## 1.4.4

### Patch Changes

- Updated dependencies [aa33c5f]
  - @shopify/theme-language-server-common@1.4.4
  - @shopify/theme-check-node@1.18.1
  - @shopify/theme-check-docs-updater@1.18.1

## 1.4.3

### Patch Changes

- Updated dependencies [84aa24c]
- Updated dependencies [96d4d5e]
- Updated dependencies [dacdd9f]
  - @shopify/theme-check-node@1.18.0
  - @shopify/theme-language-server-common@1.4.3
  - @shopify/theme-check-docs-updater@1.18.0

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

- Updated dependencies [2cf7a11]
  - @shopify/theme-check-node@1.17.0
  - @shopify/theme-language-server-common@1.3.3
  - @shopify/theme-check-docs-updater@1.17.0

## 1.3.2

### Patch Changes

- Updated dependencies [8d35241]
- Updated dependencies [201f30c]
- Updated dependencies [c0298e7]
- Updated dependencies [b3bd123]
- Updated dependencies [6fad756]
- Updated dependencies [fc86c91]
  - @shopify/theme-language-server-common@1.3.2
  - @shopify/theme-check-node@1.16.1
  - @shopify/theme-check-docs-updater@1.16.1

## 1.3.1

### Patch Changes

- Updated dependencies [f35feb4]
- Updated dependencies [279a464]
- Updated dependencies [d71a5e2]
  - @shopify/theme-language-server-common@1.3.1
  - @shopify/theme-check-node@1.16.0
  - @shopify/theme-check-docs-updater@1.16.0

## 1.3.0

### Patch Changes

- Updated dependencies [eb630b1]
- Updated dependencies [f8b4e05]
  - @shopify/theme-language-server-common@1.3.0
  - @shopify/theme-check-node@1.15.0
  - @shopify/theme-check-docs-updater@1.15.0

## 1.2.1

### Patch Changes

- Updated dependencies [b7514f4]
  - @shopify/theme-check-node@1.14.1
  - @shopify/theme-language-server-common@1.2.1
  - @shopify/theme-check-docs-updater@1.14.1

## 1.2.0

### Patch Changes

- 380b273: Inject `filesForURI` dependency and add `glob` dependency
- Updated dependencies [a05aebb]
- Updated dependencies [380b273]
  - @shopify/theme-check-node@1.14.0
  - @shopify/theme-language-server-common@1.2.0
  - @shopify/theme-check-docs-updater@1.14.0

## 1.1.0

### Patch Changes

- Updated dependencies [7457f2c]
- Updated dependencies [7457f2c]
  - @shopify/theme-language-server-common@1.1.0

## 1.0.2

### Patch Changes

- da94dfe: Fixup missing dep
  - @shopify/theme-language-server-common@1.0.2

## 1.0.1

### Patch Changes

- 14b9ee2: Fixup package.json configs
- Updated dependencies [14b9ee2]
  - @shopify/theme-language-server-common@1.0.1
  - @shopify/theme-check-docs-updater@1.13.1

## 1.0.0

### Major Changes

- 319bcf1: `@shopify/theme-language-server` initial release

### Minor Changes

- 38f549b: Add .theme-check.yml support to the new Language Server in VS Code
- acfac68: Rename `liquid-language-server-*` packages to `theme-language-server-*`

### Patch Changes

- Updated dependencies [8cd0b54]
- Updated dependencies [c00e929]
- Updated dependencies [25b79f0]
- Updated dependencies [f3cda64]
- Updated dependencies [c00e929]
- Updated dependencies [c00e929]
- Updated dependencies [12c794a]
- Updated dependencies [acfac68]
- Updated dependencies [319bcf1]
- Updated dependencies [4bb4b8d]
- Updated dependencies [c00e929]
  - @shopify/theme-language-server-common@1.0.0
  - @shopify/theme-check-docs-updater@1.13.0

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
