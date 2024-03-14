# @shopify/theme-check-common

## 2.2.2

## 2.2.1

### Patch Changes

- 8710bde: Fix AssetAppBlock{CSS,JavaScript} bug when cwd != project root

## 2.2.0

## 2.1.0

### Minor Changes

- 042f1e0: Breaking: internal rename of `schemaValidators` to `jsonValidationSet`

  This breaks the browser dependencies public API (for `startServer` and `runChecks`) and will thus require some code changes in those contexts.

  The node packages absorb the dependency injection and are not breaking.

- a9ae65f: Add Language Server and Theme Check support for checkout.liquid objects

## 2.0.4

## 2.0.3

## 2.0.2

### Patch Changes

- 0990c47: Fix config validation problem that required optional settings
- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/liquid-html-parser@2.0.3

## 2.0.1

### Patch Changes

- Fix parsing of `}}` inside `{% %}` and vice-versa
- 8f19b87: Bump lodash deps

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
  - @shopify/liquid-html-parser@2.0.1

## 1.22.0

### Minor Changes

- 636895f: Make LiquidHTMLSyntaxError more tolerant to unclosed nodes in branching code
- aeb9b3f: Add `UnclosedHTMLElement` check

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [636895f]
  - @shopify/liquid-html-parser@2.0.0

## 1.21.0

### Minor Changes

- 772a1ce: Update `translation-key-exists` check and intelligent code completion to always stay up-to-date with Shopify translation keys

### Patch Changes

- b05a6a8: Add support for the following Language Server configurations:

  - `themeCheck.checkOnOpen`
  - `themeCheck.checkOnSave`
  - `themeCheck.checkOnChange`

  This is mostly for backward compatibility and to not be annoying :)

## 1.20.1

### Patch Changes

- 79b0549: Add `app` object support for theme app extensions
- ac1deb4: Improved message reporting for `AssetSize*` checks

## 1.20.0

### Patch Changes

- Updated dependencies [78813ea]
  - @shopify/liquid-html-parser@1.1.1

## 1.19.0

### Minor Changes

- d9f3063: Do not report UnusedAssign for variables starting with an underscore

## 1.18.2

### Patch Changes

- fe54680: Fix `MissingAsset` false positives for .css.liquid, .js.liquid and .scss.liquid files
- e00c319: Fix false ParserBlockingScript reports for scripts of type module

## 1.18.1

### Patch Changes

- aa33c5f: Fix hover, completion and `UndefinedObject` reporting of `{% increment var %}` and `{% decrement var %}`
- 0d71145: Fix UnusedAssign false positives in raw-like nodes
- Updated dependencies [0d71145]
  - @shopify/liquid-html-parser@1.1.0

## 1.18.0

### Minor Changes

- 96d4d5e: Re-add `ignoreMissing` support to `MissingTemplate`

### Patch Changes

- dacdd9f: Add blocks/ files contextual completion, hover and UndefinedObject support

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

- 2cf7a11: Add support for aliases in check configs

## 1.16.1

### Patch Changes

- 8d35241: Fix `paginate` object completion, hover and `UndefinedObject` reporting
- 201f30c: Add support for `{% layout none %}`
- c0298e7: Fix `recommendations` completion, hover and `UndefinedObject` reporting
- 6fad756: Fix `predictive_search` completion, hover and `UndefinedObject` reporting
- fc86c91: Fix `form` object completion, hover and `UndefinedObject` reporting

## 1.16.0

### Minor Changes

- 279a464: Replace `AssetUrlFilters` with `RemoteAsset`

### Patch Changes

- d71a5e2: Fix completion, hover and UndefinedObject reporting of tablerowloop and forloop variables

## 1.15.0

### Patch Changes

- 6c2c00f: `UndefinedObject` should not show any offenses when themeDocset is not given
- f1a642f: Improve resilience of theme check pipeline by preventing entire failure if an individual check fails

## 1.14.1

### Patch Changes

- b7514f4: Fixup UndefinedObject for sections

## 1.14.0

### Minor Changes

- beeb85f: Introduce 'UndefinedObject' check
- a05aebb: Add `AssetSizeJavascript` check

## 1.13.1

### Patch Changes

- 14b9ee2: Fixup package.json configs

## 1.13.0

### Minor Changes

- 441a8c5: Remove `ImgLazyLoading`
- 972c26c: Introduce 'DeprecatedFilters' check (+ suggestions)
- 25b79f0: Rename LiquidDrop -> LiquidVariableLookup
- 12c794a: Add `DeprecatedTags` check

### Patch Changes

- c00e929: Bug fix for `AssetSizeCSS`: Fixes redundant messages.
- f3cda64: Fixup AppBlock\*Checks to not throw errors on missing property
- b1b8366: Fixup AssetUrlFilters node targeting
- c00e929: Bug fix for `AssetSizeAppBlockCSS`: Corrects underlining issues.
- c00e929: Bug fix for `AssetUrlFilters`: Reports better messaging.
- b1b8366: Fix RequireThemeObject highlighting
- b1b8366: Fix the recommended and severity values
- c00e929: Bug fix for `AssetSizeAppBlockJavascript`: Corrects underlining issues.
- Updated dependencies [02f4731]
  - @shopify/liquid-html-parser@1.0.0

## 1.12.1

### Patch Changes

- Patch bump because it depends on @shopify/prettier-plugin-liquid
- Updated dependencies [5479a63]
- Updated dependencies [5479a63]
  - @shopify/prettier-plugin-liquid@1.2.3

## 1.12.0

### Minor Changes

- 5ba20bd: Fixed bug for `AssetUrlFilters` check
- 5ba20bd: Add `ContentForHeaderModification` check
- 5ba20bd: Add `AssetSizeCSS` check
- 5ba20bd: Add `AssetSizeAppBlockJavascript` check
- 5ba20bd: Add `AssetSizeAppBlockCSS` check

## 1.11.1

### Patch Changes

- 2e73166: Fix the `DocsetEntry` types to better match the theme-liquid-docs json files

## 1.11.0

### Minor Changes

- e67a16d: Breaking: Dependency injected json schema validators

## 1.10.0

### Minor Changes

- 4db7c7e: Add `UnknownFilter` check
- a94f23c: Bump prettier-plugin-liquid to v1.2.1

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

## 1.8.0

### Minor Changes

- 2f0f941: Add `MissingAsset` check
- fd3fc3c: Add `AssetUrlFilters`
- 5ae97c9: Add `PaginationSize` check
- 85cf8f3: Add `CdnPreconnect`
- 051aff1: Introduce `ThemeDocset` and `ThemeSchemas` dependencies to support core checks

## 1.7.1

### Patch Changes

- Bump prettier-plugin-liquid to v1.1.0

## 1.7.0

### Minor Changes

- 502bad8: Add documentation URLs to checks

## 1.6.0

### Minor Changes

- cad8e17: Introduce API for schema definition

  **New**: The `meta.schema` property of `CheckDefinition`s accept a key-value pair of `SchemaProp`.

  ```typescript
  const schema = {
    myNumberSetting: SchemaProp.number(10),
    myStringSetting: SchemaProp.string('default'),
    myStringArraySetting: SchemaProp.array<string>(['default', 'value']),
    myBooleanSetting: SchemaProp.boolean(true),
    myObjectSetting: SchemaProp.object({
      age: SchemaProp.number(),
      name: SchemaProp.string(),
      company: SchemaProp.object({
        name: SchemaProp.string(),
      }).optional(),
    }),
  };

  // `<typeof schema>` is required to type `context.settings`.
  export const SomeCheck: LiquidCheckDefinition<typeof schema> = {
    meta: {
      code: '...',
      name: '...',
      docs: {
        /* ... */
      },
      type: SourceCodeType.LiquidHtml,
      severity: Severity.ERROR,
      schema,
      targets: [],
    },
    create(context) {
      context.settings.severity; // typed as Severity
      context.settings.myNumberSetting; // typed as number
      context.settings.myBooleanSetting; // typed as boolean
      context.settings.myStringSetting; // typed as string
      context.settings.myStringArraySetting; // typed as string[]
      context.settings.myObjectSetting.age; // typed as number | undefined
      context.settings.myObjectSetting.name; // typed as string
      context.settings.myObjectSetting.company?.name; // typed as string | undefined
      return {};
    },
  };
  ```

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

## 1.5.1

### Patch Changes

- 60c92be: Fix unhandled TranslationKeyExists error

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

## 1.4.1

### Patch Changes

- 9f8d47f: Fixup Translations type to allow strings
- a8cda19: Add TranslationKeyExists to allChecks array

## 1.4.0

### Minor Changes

- 9d419ca: Breaking: change dependency `get defaultLocale` to `getDefaultLocale(): Promise<string>`

## 1.3.0

### Minor Changes

- 72a9330: Breaking: Add `defaultLocale` dependency
- 5329963: Breaking: create one context per file

  The API for creating checks has changed:

  - We no longer pass a `file` argument to every method
  - `file` is now accessible from the `Context` object
  - We now create one context per file to avoid subtle state bugs

- 72a9330: Add check TranslationKeyExists
- 5329963: Breaking: change signature of `getDefaultTranslations` to return a `Promise<Translations>`

## 1.2.0

### Minor Changes

- 4c099d5: Add check `MissingTemplate`
- 4c099d5: Consider comments to disable checks (`# theme-check-disable/enable`)

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

## 1.0.1

### Patch Changes

- d206674: Move toSourceCode to common for use in language-server-common

## 1.0.0

### Major Changes

- 233f00f: Initial release
