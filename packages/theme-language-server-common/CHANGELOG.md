# @shopify/theme-language-server-common

## 2.2.1

### Patch Changes

- Updated dependencies [4a18a78]
  - @shopify/theme-check-common@3.2.1

## 2.2.0

### Minor Changes

- add2445: [Internal] Add better building blocks for dealing with `{% schema %}` content

### Patch Changes

- f09c923: Preload theme files on file open instead of on rename
- 0b7534b: Add a way to disable the theme preload on boot

  The `themeCheck.preloadOnBoot` (default: `true`) configuration / initializationOption can be set to `false` to prevent the preload of all theme files as soon as a theme file is opened.

  We'll use this to disable preload in admin.

- 9a07208: [Bug fix] Metafield definitions should use `namespace.key` for auto-completion
- Updated dependencies [3f7680e]
- Updated dependencies [add2445]
- Updated dependencies [8a0bf78]
- Updated dependencies [7a6dfe8]
- Updated dependencies [7317830]
- Updated dependencies [c4813ff]
- Updated dependencies [c4813ff]
- Updated dependencies [b558bfe]
- Updated dependencies [9a07208]
- Updated dependencies [f09c923]
  - @shopify/theme-check-common@3.2.0
  - @shopify/liquid-html-parser@2.1.1

## 2.1.0

### Minor Changes

- b431db7: Add `ValidateSchemaName` check
- 8f3bc18: Add "block" or "blocks" completion for the `content_for` Liquid tag (Thanks @Smintfy)
- 568d53b: Add support for the `content_for` Liquid tag
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

- 04a3275: Gate the `{Asset,Snippet}RenameHandler` behind the `workspace.applyEdit` client capability
- Updated dependencies [b431db7]
- Updated dependencies [568d53b]
- Updated dependencies [568d53b]
- Updated dependencies [6014dfd]
  - @shopify/theme-check-common@3.1.0
  - @shopify/liquid-html-parser@2.1.0

## 2.0.0

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

### Minor Changes

- 5fab0e9: Add on snippet rename automatic refactor support

  When `snippets/*.liquid` files are renamed, we'll change all the old references to point to the new files:

  - `{% render 'oldName' %}` -> `{% render 'newName' %}`
  - `{% include 'oldName' %}` -> `{% include 'newName' %}`

- 5fab0e9: Add on asset rename automatic refactor support

  When `assets/*` files are renamed, we'll change all the old references to point to the new files:

  - `{{ 'oldName.js' | asset_url }}` -> `{{ 'newName.js' | asset_url }}`
  - `{% echo 'oldName.js' | asset_url %}` -> `{% echo 'newName.js' | asset_url %}`

  Works with `.(js|css).liquid` asset files as well.

### Patch Changes

- Updated dependencies [4b574c1]
- Updated dependencies [4b574c1]
- Updated dependencies [5fab0e9]
  - @shopify/theme-check-common@3.0.0

## 1.14.0

### Minor Changes

- a0ba46d: Add Liquid tag snippet completion

  - Accept the completion item for `if` and get `{% if ${1:condition} %}\n  $0\n{% endif %}` with tabulated placeholders
    - `${1:condition}` is the first placeholder, press tab to reach the next one
    - `$0` is the last one
  - This kind of completion works for every Liquid tag and is powered by the syntax snippets on https://shopify.dev
  - The snippets are smart depending on context:
    - Will infer whitespace stripping characters based on context
    - Will not snippet complete `{%` and `%}` if inside a `{% liquid %}` tag
    - Will not snippet complete if markup is already present in the tag definition

- e36ed42: Improve HTML attribute auto-completion

  - Add `=""` to attributes that should have a value when relevant
  - Override entire attribute even if the cursor was in the middle of it

- 9bff5bd: Support renaming liquid variable names

  - only renames liquid variables enclosed within liquid tags

## 1.13.1

### Patch Changes

- c664d52: Fix HTML element close tag auto-insertion inside Liquid branches
- Updated dependencies [c664d52]
  - @shopify/liquid-html-parser@2.0.5
  - @shopify/theme-check-common@2.9.2

## 1.13.0

### Minor Changes

- b5a2fbc: Add HTML element name rename support

  Press `F2` on an HTML element name to rename its open/close pairs in a safe manner. No setting required.

  ```liquid
  {% # before rename %}
  <div>
    <!--
      press F2 on this `div` and have both the open and close parts be renamed at the same time
    -->
    <div></div>
    <div></div>
    <div></div>
  </div>

  {% # after rename %}
  <section>
    <div></div>
    <div></div>
    <div></div>
  </section>
  ```

- 474b859: Add linked editing support for HTML element names

  Just like for [HTML in VS Code](https://code.visualstudio.com/updates/v1_52#_html), this feature is enabled by the `editor.linkedEditing` VS Code setting:

  ```json
  "editor.linkedEditing": true
  ```

  When enabled, this will make it so you can rename open/close pairs as you are typing.

- d1f9fef: Add support for HTML Element close tag auto-insertion

  ```liquid
  {% # type this %}
  <div>
  {% # get this, with cursor at | %}
  <div>|</div>
  ```

- a946a4e: Add tupled highlighting of HTML element names and Liquid blocks

  When you hover over a HTML tag open, the close tag is highlighted and vice-versa.

  ```html
  <div>
    <!-- this div gets highlighted -->
    <div></div>
  </div>
  <!-- with this one-->
  ```

  When you hover over a Liquid block open, the close block is highlighted (and branches if any).

  ```liquid
  {% # this if, elsif, else, endif all get highlighted together %}
  {% if cond %}
  {% elsif cond %}

  {% else %}

  {% endif %}
  ```

### Patch Changes

- 28a5d31: Fix completion of variables inside `{% liquid %}` tag expressions
- 264321f: Remove `endliquid` as suggested auto-completion
- f0f9ec2: Add syntax to hover definitions

  Now when hovering over a liquid tag or filter we'll show syntax information if
  we have it available.

- f96425e: Fixed autocomplete for snippets where the file contained multiple periods
- Updated dependencies [1c73710]
- Updated dependencies [d1f9fef]
- Updated dependencies [70e2241]
  - @shopify/liquid-html-parser@2.0.4
  - @shopify/theme-check-common@2.9.1

## 1.12.1

### Patch Changes

- Updated dependencies [457f9cb]
- Updated dependencies [edb7f2e]
  - @shopify/theme-check-common@2.9.0

## 1.12.0

### Minor Changes

- d7c6204: Expose the `parseJSON` API in `@shopify/theme-language-server-common`

## 1.11.3

### Patch Changes

- Updated dependencies [bb79d83]
  - @shopify/theme-check-common@2.7.0

## 1.11.2

### Patch Changes

- Updated dependencies [ff78229]
  - @shopify/theme-check-common@2.6.0

## 1.11.1

### Patch Changes

- ec1fbd7: The comment object should be available to section files
- Updated dependencies [ec1fbd7]
  - @shopify/theme-check-common@2.5.1

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

- 03b41e1: Breaking: the `Config` object requires a `context` property.

  This is mostly for internal use, but documented here anyway.

### Patch Changes

- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
- Updated dependencies [03b41e1]
  - @shopify/theme-check-common@2.5.0

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
- Updated dependencies [767d223]
  - @shopify/theme-check-common@2.4.0

## 1.9.0

### Minor Changes

- 8e3c7e2: Make translation completion fuzzy
- 8e3c7e2: Add `t:` translation completion and hover support in section and theme block `{% schema %}` tags
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

- 8e3c7e2: Add `:` as a completion trigger character
- 8e3c7e2: Unify parseJSON usage
- 8e3c7e2: Fix offering of standard translations options when the default translation file is open
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-check-common@2.3.0

## 1.8.3

### Patch Changes

- @shopify/theme-check-common@2.2.2

## 1.8.2

### Patch Changes

- Updated dependencies [8710bde]
  - @shopify/theme-check-common@2.2.1

## 1.8.1

### Patch Changes

- @shopify/theme-check-common@2.2.0

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

- a9ae65f: Add Language Server and Theme Check support for checkout.liquid objects

### Patch Changes

- Updated dependencies [042f1e0]
- Updated dependencies [a9ae65f]
  - @shopify/theme-check-common@2.1.0

## 1.7.7

### Patch Changes

- @shopify/theme-check-common@2.0.4

## 1.7.6

### Patch Changes

- @shopify/theme-check-common@2.0.3

## 1.7.5

### Patch Changes

- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/liquid-html-parser@2.0.3
  - @shopify/theme-check-common@2.0.2

## 1.7.4

### Patch Changes

- Updated dependencies [fa02f1b]
- Updated dependencies [8f19b87]
  - @shopify/liquid-html-parser@2.0.2
  - @shopify/theme-check-common@2.0.1

## 1.7.3

### Patch Changes

- 7459e14: Fix hover for liquid schema and style tags

## 1.7.2

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
- Updated dependencies [8451075]
  - @shopify/theme-check-common@2.0.0
  - @shopify/liquid-html-parser@2.0.1

## 1.7.1

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [636895f]
- Updated dependencies [aeb9b3f]
- Updated dependencies [636895f]
  - @shopify/theme-check-common@1.22.0
  - @shopify/liquid-html-parser@2.0.0

## 1.7.0

### Minor Changes

- 772a1ce: Update `translation-key-exists` check and intelligent code completion to always stay up-to-date with Shopify translation keys
- b05a6a8: Add support for the following Language Server configurations:

  - `themeCheck.checkOnOpen`
  - `themeCheck.checkOnSave`
  - `themeCheck.checkOnChange`

  This is mostly for backward compatibility and to not be annoying :)

### Patch Changes

- Updated dependencies [772a1ce]
- Updated dependencies [b05a6a8]
  - @shopify/theme-check-common@1.21.0

## 1.6.0

### Minor Changes

- a120393: Add better auto-closing UX for Liquid pairs

  - Type `{{` get `{{ | }}` (cursor at `|`)
  - Type `{{-` get `{{- | -}}`
  - Type `{%` get `{% | %}`
  - Type `{%-` get `{%- | -%}`
  - Add a `-` on one side, only that side is affected
  - See [PR](https://github.com/Shopify/theme-tools/pull/242) for video
  - Only for `shopifyLiquid.themeCheckNextDevPreview`

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
