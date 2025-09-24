# @shopify/theme-check-common

## 3.23.0

### Minor Changes

- f00a1620: Remove 'CaptureOnContentForBlock' check — Theme development standards have evolved and changed, and this check has been fully deactivated on major themes. With more intense use blocks, this technique proven as a good approach to avoid duplication and promote reusability

### Patch Changes

- 450b3f28: Add schema translation go-to-definition support
- 4bcb1126: Add translation key go-to-definition support
- dd1f4c8f: Fix false-positive reporting of UndefinedObject within {% schema %} tags

## 3.22.0

### Minor Changes

- 0380e438: Added a new OrphanedSnippet theme check to discover and warn if a snippet isn't referenced anywhere

### Patch Changes

- 2fb378ca: Add check to find/fix unsupported parenthesis
- 0c0f6c06: Add check for invalid loop arguments for `for` and `tablerow` tags
- c2228360: Detect and report invalid ranges in loops
- 2784a83b: Change wording around syntax errors for invalid conditional nodes in Liquid HTML Syntax check
- 39a6e632: Remove AST check on fixed code suggestions

## 3.21.0

### Minor Changes

- 1ebf9246: Detect and fix use of boolean expressions

### Patch Changes

- a7d0e2d0: Find+fix echo tags & variable output with no value
- e1bf12c7: Introduce fix for invalid `assign` tag values
- 374ff3de: Allow boolean expressions in schema tag
- b226e52c: Fix syntax check for tags where multiple instances of same error occur
- 0bfc7859: Find/fix multiple `echo` values
- Updated dependencies [6a1512db]
- Updated dependencies [1ebf9246]
  - @shopify/liquid-html-parser@2.9.0

## 3.20.1

### Patch Changes

- d605777f: Remove theme-check ValidDocParamNames

## 3.20.0

### Minor Changes

- 4ae72589: Introduce "Deprecated Fonts on Settings Schema" check

### Patch Changes

- f28daa84: [Internal] Fix incorrect references to libraries
- 23992051: Update liquid paginate max limit rule from 50 to 250
- 8ab6a8e7: Update list of deprecated fonts

## 3.19.0

### Minor Changes

- a3a513dc: Introduce new DeprecatedFontsOnSectionsAndBlocks check

## 3.18.1

### Patch Changes

- ce5cb33a: Gracefully handle files that are not part of a theme

## 3.18.0

### Minor Changes

- 649da6df: Introduce check that warn developers that `{% stylesheet %}` and `{% javascript %}` tags only support static content
- 444c9edc: Add hardcoded-routes theme check which reports a warning when hardcoded routes are used instead of the routes object

### Patch Changes

- 4477a6d9: Fix small bug in path.basename
- 606053f1: Fix ValidBlockTarget for blocks in `default` and `presets`

  - Solves issue so nested blocks inside of `presets` are now validated
  - Solves issue so block types inside of `default` are now validated

## 3.17.1

### Patch Changes

- 4d9ba806: Allow `//`, `/*`, `*/` inside of strings in template JSON

## 3.17.0

### Minor Changes

- c3504252: Introduce ability the disable theme checks for the next Liquid statement

  - Add `{% # theme-check-disable-next-line %}` to disable theme checks on the next Liquid statement
  - To disable a specific theme-check rule, add the name(s) after `theme-check-disable-next-line`
    in a comma separated format

### Patch Changes

- 20625a1b: Fix validation for static blocks in JSON templates

## 3.16.1

### Patch Changes

- 83b1b760: No longer lint global objects as invalid parameters in the `ValidDocParamNames` check

## 3.16.0

### Minor Changes

- a1fa7376: Support LiquidDoc param array types

  - LiquidDoc param types supports 1D arrays as param types
  - Square brackets are placed after the param type to denote arrays

  E.g.

  ```
  {% doc %}
    @param {product[]} my_products - an array of products
    @param {string[]} my_strings - an array of strings
  {% enddoc %}
  ```

### Patch Changes

- 37f41c6e: For aliased filters, show the docs of the base docset entry
- 7f243690: Fix RemoteAsset false positive for /cdn URLs
- 90577cd2: Fix hover when cursor is directly after a `.`
- 19f5589b: [internal] Export `getBlockName` helper utility

## 3.15.1

### Patch Changes

- d7949240: Fix bug where self-assigned variables were warned as an offense, even when defined by a @param

## 3.15.0

### Minor Changes

- 4d557619: Add `content_for` argument theme checks if static block has LiquidDoc

  - DuplicateContentForArguments - Ensures arguments provided for `content_for` tag are unique
  - MissingContentForArguments - Ensures all required arguments, as per LiquidDoc, are provided
  - UnrecognizedContentForArguments - Ensures arguments provided exclusively match LiquidDoc params
  - ValidContentForArgumentTypes - Ensures arguments match type defined in LiquidDoc

- c0f42c37: Restrict LiquidDoc param names in blocks based on `content_for` tag params

  - LiquidDoc inside blocks have limitations on names because `content_for` tag uses the following param names:
    - id
    - type
    - attributes
    - block
    - blocks
    - class
    - context
    - inherit
    - resource
    - resources
    - schema
    - section
    - sections
    - settings
    - snippet
    - snippets
    - template
    - templates

### Patch Changes

- 067a75eb: Improve parsing logic around aliases
- aa43656b: [internal] Building blocks to support LiquidDoc for blocks
- dccca5a5: Bugfix ensures `content_for` argument theme check allows `closest.` args
- 39339f88: visible_if should not warn on use of 'section' in a block file
- 660bd7df: Allow UndefinedObject check on snippets
- c0f42c37: Add reserved parameters to the `content_for` tag
- Updated dependencies [067a75eb]
  - @shopify/liquid-html-parser@2.8.2

## 3.14.1

### Patch Changes

- 906455b0: Fix ValidBlockTarget reporting of static block presets

## 3.14.0

### Minor Changes

- e75f896d: [Feature] Support more types for LiquidDoc param

  - Support [liquid objects](https://shopify.dev/docs/api/liquid/objects) as LiquidDoc param type
    - Object is NOT supported if it is exclusively a global liquid variable
    - Object is NOT supported if it is deprecated

### Patch Changes

- b6f94d16: Make the ValidVisibleIf check accept boolean literals
- 75c02293: Fix slow render tag theme checks
- 034a803b: Updated UndefinedObject check to recognize variables declared via `@param` within doc tags in blocks

## 3.13.1

### Patch Changes

- Updated dependencies [7ff54f02]
  - @shopify/liquid-html-parser@2.8.1

## 3.13.0

### Minor Changes

- 886ee4b1: Update theme blocks to support static arguments only in static blocks without the `context` namespace
- cf51a514: Update UnsupportDocTags check to accept the {% doc %} tag in theme blocks

### Patch Changes

- d9204c55: Fix: Be less strict about numbers in VariableName
- 3fff76bf: Do not report errors when using a Liquid doc @param name of a non global variable
- Updated dependencies [1a95a190]
  - @shopify/liquid-html-parser@2.8.0

## 3.12.0

### Minor Changes

- ea9f2451: Reintroduce support for `context` parameters in the `content_for` tag
- 6268e838: Allow `recommendations` as a global variable in `blocks/`

### Patch Changes

- d42ed610: Fix indentation for multi-line examples and descriptions

## 3.11.1

### Patch Changes

- 9ffbe27d: Remove `brand` from list of metafield owner types being fetched

  - Brand is removed from ownerType
  - https://shopify.dev/docs/api/admin-graphql/latest/queries/metafieldDefinitions

## 3.11.0

### Minor Changes

- 8a0393a1: Theme check to ensure liquid doc param names don't collide with reserved words

  - Theme check will report a warning if param name collides with global liquid objects
  - Theme check will report a warning if param name collides with liquid tags

- 0d96194e: Update MissingRenderSnippetParams to report when alias variable are provided using `with/for` syntax.
- 21354237: Update UnrecognizedRenderSnippetParams to report when alias variable are provided using `with/for` syntax.
- c55077e7: Split ValidRenderSnippetParams theme check into MissingRenderSnippetParams and UnrecognizedRenderSnippetParams. This allows them to be disabled independantly.
- 48d4d79e: Update ValidRenderSnippetParamTypes to report when alias variable are provided using `with/for` syntax.
- a851f379: Add DuplicateRenderSnippetParams theme check

  Introduces a new theme check to detect and report duplicate parameters in Liquid render tags. The check:

  - Identifies duplicate parameter names in render snippets
  - Provides suggestions to remove redundant parameters

### Patch Changes

- dafba833: [Internal] Update `getSnippetDefinitions` and `RenderSnippetHoverProvider` to account for trimmed newline characters in description and example nodes content.
- Updated dependencies [de877551]
  - @shopify/liquid-html-parser@2.7.0

## 3.10.0

### Minor Changes

- 10493c9d: New `UnusedDocParam` theme-check rule

  - Theme check will verify that parameters defined within a snippet's `doc` header are used within the body

- f130a78f: Introduce a new theme check which validates the types of parameters passed to snippets against the liquidDoc header.

  - Reports type mismatches
  - Suggests autofixes (replace with default or remove value)
  - Skips type checking for variable lookups
  - Skips type checking for unknown parameters
  - Skips type checking for unknown types

- 1a4482eb: New theme checks to validate liquid doc params

  - `UniqueDocParamNames` will check if param names are unique within the `doc` tag
  - `ValidDocParamTypes` will check if the param types defined in the `doc` tag are supported

- 79c9f773: Update getSnippetDefinition `definition` property to return implicit description if provided.

  Implicit descriptions are provided as text before any annotations `@` are provided. This overrides any `@description` annotations.

- 754f7f66: New theme check to ensure `doc` tag is only used in snippet files

### Patch Changes

- 5ad43a8c: Fixed issue with normalize method not working properly on windows due to not replacing backslashes with forward slashes
- dc8c9fda: Add RemoteAsset allowedDomains check to validate CDN and approved domain usage for better performance and developer experience
- beccb69e: Fixed local blocks validation to not consider preset blocks as containing local blocks when a name is present
- Updated dependencies [10493c9d]
- Updated dependencies [79c9f773]
- Updated dependencies [9563715a]
  - @shopify/liquid-html-parser@2.6.0

## 3.9.0

### Minor Changes

- 0bb780de: Add `ValidVisibleIf` check to ensure `visible_if` expressions are well-formed and only reference defined settings keys

### Patch Changes

- f077a9ec: [internal] Adding list of supported doc tag types

## 3.8.0

### Minor Changes

- fe84a17a: Add ValidRenderSnippetParams check which validates args passed to snippets with LiquidDoc definitions

  - Checks that required parameters are provided
  - Checks that unknown parameters are not provided

- 055cef77: Theme check verifies if setting key exists within block schemas and section schemas

  - Check if the keys inside `presets.[].settings` and `default.settings` exist as `settings.[].id` in the same file
  - Check if the keys inside `presets.[](recursive .blocks.[]).settings` and `default.blocks.[].settings` exist as `settings.[].id` inside the referenced block's file

- e9c1d98a: Move `getSnippetDefinition` to theme-check-common

### Patch Changes

- d32afb7f: Improve type adherence of `getSnippetDefinition`. The function now returns `undefined` when the corresponding properties are empty.
- Updated dependencies [c4bbf3b5]
- Updated dependencies [d9dbc265]
- Updated dependencies [2db3047f]
- Updated dependencies [261c2958]
  - @shopify/liquid-html-parser@2.5.0

## 3.7.2

### Patch Changes

- 2ef93d17: [internal] Add `strict` arg for `parseJSON`. The default schema JSON parsed is more laxed.
- Updated dependencies [e57979e0]
- Updated dependencies [8c9f5bcf]
  - @shopify/liquid-html-parser@2.4.0

## 3.7.1

### Patch Changes

- 841ca6d1: Update repository URL for all packages to be case sensitive
- Updated dependencies [841ca6d1]
  - @shopify/liquid-html-parser@2.3.2

## 3.7.0

### Minor Changes

- c85a6131: Cache liquidDoc fetch results
- 913d5386: Add unique settings ID validator to prevent duplicate IDs in theme configurations
- 931dc9b9: Add hover support for Liquid snippets using {% doc %} annotations

### Patch Changes

- Updated dependencies [dd0cd4d2]
  - @shopify/liquid-html-parser@2.3.1

## 3.6.1

### Patch Changes

- Updated dependencies [ac55577a]
  - @shopify/liquid-html-parser@2.3.0

## 3.6.0

### Minor Changes

- b31e0f85: [internal] Add `offset` information on Schema objects
- 34c2268a: This update ensures that the AppBlockMissingSchema theme check will only run on block files on theme app extensions, to avoid errors surfacing when the theme check is incorrectly run on snippets. Renamed the check to make it more accurate (from MissingSchema to AppBlockMissingSchema).

### Patch Changes

- c74850c8: [Internal] Add template type interfaces
- c60e61ba: [Internal] Add schema raw value to schema node

## 3.5.0

### Minor Changes

- d7436b4a: Add `JsonMissingBlock` check
- 6f1862c8: Add `SchemaPresetsStaticBlocks` check
- d01e657b: [Internal] Add JSONC support to the AST parser

### Patch Changes

- 8e909870: Import fix for PropertyNode in JSONMissingBlock.

## 3.4.0

### Minor Changes

- 8912fab8: Update Ohm grammar for ContentFor tag to extract arguments correctly
  Update ValidContentForArguments check to report deprecated context. argument usage
- 51ec6a7a: Add case to `SchemaPresetBlockOrder` check

### Patch Changes

- Updated dependencies [8912fab8]
  - @shopify/liquid-html-parser@2.2.0

## 3.3.0

### Minor Changes

- 05ae5ea8: Added `MissingSchema` theme check to identify missing schemas in theme app extensions.
- 26215724: Add `EmptyBlockContent` Check
- 73758ba1: Add `LiquidFreeSettings` check
- 5e8a2bfe: Add `SchemaPresetsBlockOrder` check

### Patch Changes

- 05b928ea: [internal] Rejig how we do JSON completion & Hover
- a579d59e: (internal) Fixup bug in nodeAtPath
- d2b5942a: Add positional attribute to exported Parameter type
- 3e69d732: Update theme check urls
- 1083b2bc: Refactor `ValidBlockTarget` and `ValidLocalBlocks`.
- 5a2caaee: Import `Section` and `ThemeBlock` types.
- Updated dependencies [1f54be13]
  - @shopify/liquid-html-parser@2.1.2

## 3.2.2

### Patch Changes

- 16e2f37: Temporarily disable ValidLocalBlocks

## 3.2.1

### Patch Changes

- 4a18a78: Temporarily disable ValidBlockTarget

## 3.2.0

### Minor Changes

- 3f7680e: Add the `ValidBlockTarget` Check
- 8a0bf78: Add the `ValidLocalBlocks` Check
- c4813ff: Add the `BlockIdUsage` check
- 7317830: Add translation checking to `ValidSchemaName` check
- add2445: [Internal] Add better building blocks for dealing with `{% schema %}` content

### Patch Changes

- 7a6dfe8: Fix weird root URI loading bug
- b558bfe: Fixup `CaptureOnContentForBlock` check
- 9a07208: [Bug fix] Metafield definitions should use `namespace.key` for auto-completion
- f09c923: Moving internal methods around
- Updated dependencies [c4813ff]
  - @shopify/liquid-html-parser@2.1.1

## 3.1.0

### Minor Changes

- b431db7: Add `ValidateSchemaName` check
- 568d53b: Add the `ValidContentForArguments` check
- 6014dfd: Support metafield auto-completion based on .shopify/metafields.json file

  - The metafield definitions can be fetched from Admin API
  - The format of the JSON needs to be the following:

  ```
  {
      "<definition_group>": [
          {
              "name": "...",
              "namespace": "...",
              "description": "...",
              "type": {
                  "category": "...",
                  "name": "..."
              },
          },
          ...
      ],
      ...
  }
  ```

  The definition group needs to be one of the following:

  - 'article'
  - 'blog'
  - 'brand'
  - 'collection'
  - 'company'
  - 'company_location'
  - 'location'
  - 'market'
  - 'order'
  - 'page'
  - 'product'
  - 'variant'
  - 'shop'

### Patch Changes

- Updated dependencies [568d53b]
  - @shopify/liquid-html-parser@2.1.0

## 3.0.0

### Major Changes

- 4b574c1: [Breaking] Replace absolute path concerns with URIs

  This implies a couple of changes:

  - `Config` now holds a `rootUri` instead of `root` path.
  - `loadConfig` injections needs to change their return value accordingly
  - In checks,
    - The context helper `absolutePath` has been replaced by `toUri`
    - The context helper `relativePath` has been replaced by `toRelativePath`
  - `SourceCode` objects now hold a `uri` instead of a `path`
  - `toSourceCode` now accepts a `uri` instead of a `path`

- 4b574c1: [Breaking] Replace fs-based dependency injections with AbstractFileSystem injection

  ```diff
  runChecks(theme, {
  - getDefaultTranslations,
  - getDefaultLocale,
  - getDefaultSchemaLocale,
  - getDefaultSchemaTranslations,
  - fileExists,
  - fileSize,
  + fs: new FileSystemImpl(),
    themeDocset,
    jsonValidationSet,
  })
  ```

### Patch Changes

- 5fab0e9: (Internal) Add path.basename util

## 2.9.2

### Patch Changes

- Updated dependencies [c664d52]
  - @shopify/liquid-html-parser@2.0.5

## 2.9.1

### Patch Changes

- Updated dependencies [1c73710]
- Updated dependencies [d1f9fef]
- Updated dependencies [70e2241]
  - @shopify/liquid-html-parser@2.0.4

## 2.9.0

### Minor Changes

- 457f9cb: Add CaptureOnContentForBlock check
- edb7f2e: Standardized variable number formatting

## 2.7.0

### Minor Changes

- bb79d83: Add VariableName check

## 2.6.0

### Minor Changes

- ff78229: Update 'theme-check-common/src/json.ts' to use 'jsonc-parser'

## 2.5.1

### Patch Changes

- ec1fbd7: The comment object should be available to section files

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

## 2.4.0

### Minor Changes

- 767d223: Add `ValidJSON` check

  This check validates JSON files against the JSON schemas provided in
  the `jsonValidationSet` provided there is a file match.

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

## 2.3.0

### Minor Changes

- 8e3c7e2: Add Schema translation checking to `MatchingTranslations`
- 8e3c7e2: Breaking: add `getDefaultSchema{Locale,Translations}(Factory)?` dependencies

  To be used to power `MatchingTranslations` for [Schema translations](https://shopify.dev/docs/storefronts/themes/architecture/locales/schema-locale-files).

  To be used to power Schema translations code completion and hover in section and theme block `{% schema %}` JSON blobs.

### Patch Changes

- 8e3c7e2: Unify parseJSON usage

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
