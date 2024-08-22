# @shopify/theme-check-node

## 2.9.0

### Minor Changes

- 457f9cb: Add CaptureOnContentForBlock check

### Patch Changes

- Updated dependencies [457f9cb]
- Updated dependencies [edb7f2e]
  - @shopify/theme-check-common@2.9.0
  - @shopify/theme-check-docs-updater@2.9.0

## 2.7.0

### Minor Changes

- bb79d83: Add VariableName check

### Patch Changes

- Updated dependencies [bb79d83]
  - @shopify/theme-check-common@2.7.0
  - @shopify/theme-check-docs-updater@2.7.0

## 2.6.0

### Patch Changes

- Updated dependencies [ff78229]
  - @shopify/theme-check-common@2.6.0
  - @shopify/theme-check-docs-updater@2.6.0

## 2.5.1

### Patch Changes

- 0dc03a9: Prevent loading the same plugin more than once
- 312d804: Add logging support to the docs loader
- Updated dependencies [ec1fbd7]
- Updated dependencies [312d804]
  - @shopify/theme-check-common@2.5.1
  - @shopify/theme-check-docs-updater@2.5.1

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

- 03b41e1: Theme Check Config files now accept the `context` property

  In your `.theme-check.yml` files, you can set the `context` property to `theme` or `app`. By default, it's `theme`. The `theme-check:theme-app-extension` config sets it to `app`.

  You shouldn't need to care about this. It's there so we can do contextual things internally.

- 03b41e1: Add support for the schemas manifest on Shopify/theme-liquid-docs

  Shopify/theme-liquid-docs now supports composable JSON schemas (with relative paths). To solve the `blocks/*.liquid` file match JSON schema overload depending on the context (`app` or `theme`), we defined two manifests that describe the schemas required by your solution and define the fileMatch rules:

  - [manifest_theme.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)
  - [manifest_theme_app_extension.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)

  `@shopify/theme-check-docs-updater` now reads those manifests and downloads the tree of dependency that they require. We will no longer need to make new theme-tools releases whenever we add new schemas. We'll be able to dev them and their file associations directly from Shopify/theme-liquid-docs and have downstream consumers updated automatically (the same way docs are automatically updated).

### Patch Changes

- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
  - @shopify/theme-check-docs-updater@2.5.0
  - @shopify/theme-check-common@2.5.0

## 2.4.0

### Patch Changes

- Updated dependencies [767d223]
- Updated dependencies [767d223]
- Updated dependencies [767d223]
  - @shopify/theme-check-common@2.4.0
  - @shopify/theme-check-docs-updater@2.4.0

## 2.3.0

### Minor Changes

- 8e3c7e2: Breaking: add `getDefaultSchema{Locale,Translations}(Factory)?` dependencies

  To be used to power `MatchingTranslations` for [Schema translations](https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files).

  To be used to power Schema translations code completion and hover in section and theme block `{% schema %}` JSON blobs.

### Patch Changes

- 8e3c7e2: Unify parseJSON usage
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-check-common@2.3.0
  - @shopify/theme-check-docs-updater@2.3.0

## 2.2.2

### Patch Changes

- 08ca661: Fix theme file glob on Windows (CLI issue)
  - @shopify/theme-check-common@2.2.2
  - @shopify/theme-check-docs-updater@2.2.2

## 2.2.1

### Patch Changes

- Updated dependencies [8710bde]
  - @shopify/theme-check-common@2.2.1
  - @shopify/theme-check-docs-updater@2.2.1

## 2.2.0

### Minor Changes

- d66d49c: Add `{findRoot, reusableFindRoot, PathHandler}` to the public API

### Patch Changes

- d66d49c: Improve root finding of theme app extensions and zipped themes

  Folders for which all the following is true are considered a root:

  - have a `snippets/` folder, and
  - don't have a `../.theme-check.yml`,
  - don't have a `../../.theme-check.yml`.

  No config file or `.git` folder required.

- d66d49c: Unify root finding algorithm for node LS and TC packages
  - @shopify/theme-check-common@2.2.0
  - @shopify/theme-check-docs-updater@2.2.0

## 2.1.0

### Minor Changes

- 042f1e0: internal rename of `schemaValidators` to `jsonValidationSet`

  The node packages absorbs this change and the dependency injection is not breaking.

### Patch Changes

- 402f151: Improve YAML parsing error messages caused by YAML aliases

  ```yaml
  ignore:
    # this causes an error because * at the start of a statement in YAML
    # is used for aliases to anchors such as `&.code-workspaces`
    - *.code-workspaces

    # what you want is this
    - '*.code-worksapces'
  ```

  It’s a pretty obscure error for the non-initiated, so now we’ll
  instead throw an error like this:

  ```
  YAML parsing error: Unresolved alias *.code-workspaces
  Did you forget to wrap it in quotes? '*.code-workspaces'
  ```

- Updated dependencies [042f1e0]
- Updated dependencies [a9ae65f]
  - @shopify/theme-check-docs-updater@2.1.0
  - @shopify/theme-check-common@2.1.0

## 2.0.4

### Patch Changes

- Updated dependencies [84f9eda]
  - @shopify/theme-check-docs-updater@2.0.4
  - @shopify/theme-check-common@2.0.4

## 2.0.3

### Patch Changes

- e5022ee: Fix loadConfig export to automatically select .theme-check.yml if present
  - @shopify/theme-check-common@2.0.3
  - @shopify/theme-check-docs-updater@2.0.3

## 2.0.2

### Patch Changes

- 0990c47: Fix config validation problem that required optional settings
- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/theme-check-common@2.0.2
  - @shopify/theme-check-docs-updater@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [8f19b87]
  - @shopify/theme-check-common@2.0.1
  - @shopify/theme-check-docs-updater@2.0.1

## 2.0.0

### Major Changes

- 8451075: **Theme Check 2.0**

  Our official release of the next iteration of Theme Check, the linter for Shopify themes.

  What is is: A TypeScript rewrite of [Theme Check](https://github.com/Shopify/theme-check).

  But... _why_? A couple of reasons:

  - To lint Liquid files, we prefer _one_ Abstract Syntax Tree (AST) per file. Not one Liquid AST _and_ one HTML AST.
    - Theme Check Ruby had weird duplicated checks because of that (such as `ParserBlockingJavaScript` and `ParserBlockingScriptTag`)
    - For that we reused the `@shopify/liquid-html-parser` we wrote for the prettier plugin.
    - One tree, two languages.
  - We wanted to run the linter in the Online Store Code Editor and—unlike WASM or WebSockets—there is no overhead or latency cost to running a TypeScript-based Language Server in a Web Worker.
  - Theme developers are Front End developers. If we were to make a Venn diagram, we'd observe that the intersection of Ruby _and_ Theme developers is much smaller than that of JavaScript _and_ Theme developers.
    - This makes the TypeScript codebase easier to contribute to.
    - This makes the plugin ecosystem more accessible (you're more likely to have a `package.json` file in a theme than a `Gemfile`).
  - The `@shopify/cli` was rewritten in TypeScript. This made the Ruby integration very problematic.
    - Windows performance was terrible
    - Installation setup was weird, often problematic and complicated
  - The VS Code extension required a secondary installation step, and thus lost the ability to automatically self-update

  With the move to TypeScript, we believe that it will make it easier for us to ship more robust features _faster_.

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
- Updated dependencies [8451075]
  - @shopify/theme-check-common@2.0.0
  - @shopify/theme-check-docs-updater@2.0.0

## 1.22.0

### Minor Changes

- 636895f: Make LiquidHTMLSyntaxError more tolerant to unclosed nodes in branching code
- aeb9b3f: Add `UnclosedHTMLElement` check

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [aeb9b3f]
  - @shopify/theme-check-common@1.22.0
  - @shopify/theme-check-docs-updater@1.22.0

## 1.21.0

### Patch Changes

- Updated dependencies [772a1ce]
- Updated dependencies [b05a6a8]
  - @shopify/theme-check-docs-updater@1.21.0
  - @shopify/theme-check-common@1.21.0

## 1.20.1

### Patch Changes

- Updated dependencies [79b0549]
- Updated dependencies [ac1deb4]
  - @shopify/theme-check-common@1.20.1
  - @shopify/theme-check-docs-updater@1.20.1

## 1.20.0

### Minor Changes

- 78813ea: Export config types (modern identifiers, legacy identifiers, etc.)

### Patch Changes

- 78813ea: Fix root finding for theme app extensions without a config file
  - @shopify/theme-check-common@1.20.0
  - @shopify/theme-check-docs-updater@1.20.0

## 1.19.0

### Patch Changes

- Updated dependencies [d9f3063]
  - @shopify/theme-check-common@1.19.0
  - @shopify/theme-check-docs-updater@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [fe54680]
- Updated dependencies [e00c319]
  - @shopify/theme-check-common@1.18.2
  - @shopify/theme-check-docs-updater@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [aa33c5f]
- Updated dependencies [0d71145]
  - @shopify/theme-check-common@1.18.1
  - @shopify/theme-check-docs-updater@1.18.1

## 1.18.0

### Minor Changes

- 96d4d5e: Re-add `ignoreMissing` support to `MissingTemplate`

### Patch Changes

- 84aa24c: Superfluous settings as warnings not errors
- Updated dependencies [96d4d5e]
- Updated dependencies [dacdd9f]
  - @shopify/theme-check-common@1.18.0
  - @shopify/theme-check-docs-updater@1.18.0

## 1.17.0

### Minor Changes

- 2cf7a11: Rename and alias a couple of checks

  - `DeprecatedFilters` -> `DeprecatedFilter`
  - `DeprecatedTags` -> `DeprecatedTag`
  - Alias `LiquidHTMLSyntaxError` with `SyntaxError` and `HtmlParsingError`
  - Alias `ParserBlockingJavaScript` with `ParserBlockingScriptTag`
  - Alias `JSONSyntaxError` with `ValidJson`
  - Alias `AssetSizeCSS` with `AssetSizeCSSStylesheetTag`
  - Alias `RemoteAsset` with `AssetUrlFilters`

### Patch Changes

- Updated dependencies [2cf7a11]
- Updated dependencies [2cf7a11]
  - @shopify/theme-check-common@1.17.0
  - @shopify/theme-check-docs-updater@1.17.0

## 1.16.1

### Patch Changes

- b3bd123: Fix backward compatibility with legacy `{include,exclude}_categories` settings
- Updated dependencies [8d35241]
- Updated dependencies [201f30c]
- Updated dependencies [c0298e7]
- Updated dependencies [6fad756]
- Updated dependencies [fc86c91]
  - @shopify/theme-check-common@1.16.1
  - @shopify/theme-check-docs-updater@1.16.1

## 1.16.0

### Minor Changes

- 279a464: Add `RemoteAsset` check

### Patch Changes

- Updated dependencies [279a464]
- Updated dependencies [d71a5e2]
  - @shopify/theme-check-common@1.16.0
  - @shopify/theme-check-docs-updater@1.16.0

## 1.15.0

### Minor Changes

- f8b4e05: Runs theme check with external docs

### Patch Changes

- Updated dependencies [6c2c00f]
- Updated dependencies [f1a642f]
  - @shopify/theme-check-common@1.15.0
  - @shopify/theme-check-docs-updater@1.15.0

## 1.14.1

### Patch Changes

- b7514f4: Fixup UndefinedObject for sections
- Updated dependencies [b7514f4]
  - @shopify/theme-check-common@1.14.1

## 1.14.0

### Minor Changes

- a05aebb: Add `AssetSizeJavascript` check

### Patch Changes

- Updated dependencies [beeb85f]
- Updated dependencies [a05aebb]
  - @shopify/theme-check-common@1.14.0

## 1.13.1

### Patch Changes

- 14b9ee2: Fixup package.json configs
- Updated dependencies [14b9ee2]
  - @shopify/theme-check-common@1.13.1

## 1.13.0

### Minor Changes

- 441a8c5: Remove `ImgLazyLoading`
- 12c794a: Add `DeprecatedTags` check
- 38f549b: Add .theme-check.yml support to the new Language Server in VS Code

### Patch Changes

- c00e929: Bug fix for `AssetSizeCSS`: Fixes redundant messages.
- 7838869: Remove unused dep in theme-check-node
- c00e929: Bug fix for `AssetSizeAppBlockCSS`: Corrects underlining issues.
- c00e929: Bug fix for `AssetUrlFilters`: Reports better messaging.
- b1b8366: Fix the recommended and severity values
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

- Patch bump because it depends on @shopify/prettier-plugin-liquid
- Updated dependencies
- Updated dependencies [5479a63]
- Updated dependencies [5479a63]
  - @shopify/theme-check-common@1.12.1
  - @shopify/prettier-plugin-liquid@1.2.3

## 1.12.0

### Minor Changes

- 5ba20bd: Fixed bug for `AssetUrlFilters` check
- 5ba20bd: Add `ContentForHeaderModification` check
- 5ba20bd: Add `AssetSizeCSS` check
- 5ba20bd: Add `AssetSizeAppBlockJavascript` check
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
