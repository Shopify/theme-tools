## theme-check-vscode

## 3.5.6

### Patch Changes

- Patch bump because it depends on:
  - @shopify/prettier-plugin-liquid
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies [f077a9ec]
- Updated dependencies [0bb780de]
- Updated dependencies [085aabbe]
  - @shopify/theme-check-common@3.9.0
  - @shopify/prettier-plugin-liquid@1.8.2
  - @shopify/theme-language-server-browser@2.9.0
  - @shopify/theme-language-server-node@2.9.0

## 3.5.5

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies
- Updated dependencies [fe84a17a]
- Updated dependencies [055cef77]
- Updated dependencies [c4bbf3b5]
- Updated dependencies [d9dbc265]
- Updated dependencies [e9c1d98a]
- Updated dependencies [2db3047f]
- Updated dependencies [261c2958]
- Updated dependencies [d32afb7f]
  - @shopify/prettier-plugin-liquid@1.8.1
  - @shopify/theme-check-common@3.8.0
  - @shopify/liquid-html-parser@2.5.0
  - @shopify/theme-language-server-browser@2.8.0
  - @shopify/theme-language-server-node@2.8.0

## 3.5.4

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/prettier-plugin-liquid
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies [2ef93d17]
- Updated dependencies [e57979e0]
- Updated dependencies [357feaa8]
- Updated dependencies [2ef93d17]
- Updated dependencies [8c9f5bcf]
  - @shopify/theme-check-common@3.7.2
  - @shopify/prettier-plugin-liquid@1.8.0
  - @shopify/liquid-html-parser@2.4.0
  - @shopify/theme-language-server-node@2.7.0
  - @shopify/theme-language-server-browser@2.7.0

## 3.5.3

### Patch Changes

- 841ca6d1: Update repository URL for all packages to be case sensitive
- Updated dependencies [841ca6d1]
  - @shopify/theme-language-server-browser@2.6.1
  - @shopify/theme-language-server-node@2.6.1
  - @shopify/prettier-plugin-liquid@1.7.2
  - @shopify/liquid-html-parser@2.3.2
  - @shopify/theme-check-common@3.7.1

## 3.5.2

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies
- Updated dependencies [c85a6131]
- Updated dependencies [913d5386]
- Updated dependencies [931dc9b9]
- Updated dependencies [dd0cd4d2]
  - @shopify/prettier-plugin-liquid@1.7.1
  - @shopify/theme-check-common@3.7.0
  - @shopify/liquid-html-parser@2.3.1
  - @shopify/theme-language-server-browser@2.6.0
  - @shopify/theme-language-server-node@2.6.0

## 3.5.1

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/prettier-plugin-liquid
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies [ac55577a]
  - @shopify/prettier-plugin-liquid@1.7.0
  - @shopify/liquid-html-parser@2.3.0
  - @shopify/theme-language-server-browser@2.5.0
  - @shopify/theme-language-server-node@2.5.0
  - @shopify/theme-check-common@3.6.1

## 3.5.0

### Minor Changes

- dc9c6da6: In `{% schema %}` tags, add block type completion in presets
- c60e61ba: In `{% schema %}` tags, add hover and code completion of presets settings ids
- 4a429e15: Fetch metafield definitions on start-up using CLI
- c74850c8: Add "On section rename" handling

  When `sections/*.liquid` files are renamed, we will update all references to these files in their previous locations. This includes:

  - `templates/*.json` files that referenced the old file name
  - `sections/*.json` files that referenced the old file name
  - Static section calls formatted as `{% section 'old-name' %}`

- b31e0f85: Add "On theme block rename" handling

  Whenever a theme block gets renamed, the following will now happen:

  1. References in files with a `{% schema %}` will be updated automatically
  2. References in template files will be updated automatically
  3. References in section groups will be updated automatically
  4. References in `{% content_for "block", type: "oldName" %}` will be updated automatically

### Patch Changes

- Updated dependencies [68e1b44b]
- Updated dependencies [c74850c8]
- Updated dependencies [c60e61ba]
- Updated dependencies [b31e0f85]
- Updated dependencies [34c2268a]
- Updated dependencies [4a429e15]
  - @shopify/theme-language-server-node@2.4.0
  - @shopify/theme-check-common@3.6.0
  - @shopify/theme-language-server-browser@2.4.0

## 3.4.0

### Minor Changes

- 6f1862c8: Add `SchemaPresetsStaticBlocks` check
- d7436b4a: Add `JsonMissingBlock` check

### Patch Changes

- Updated dependencies [8e909870]
- Updated dependencies [d7436b4a]
- Updated dependencies [6f1862c8]
- Updated dependencies [d01e657b]
  - @shopify/theme-check-common@3.5.0
  - @shopify/theme-language-server-browser@2.3.3
  - @shopify/theme-language-server-node@2.3.3

## 3.3.2

### Patch Changes

- Patch bump because it depends on:
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-language-server-browser@2.3.2
  - @shopify/theme-language-server-node@2.3.2

## 3.3.1

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies
- Updated dependencies [8912fab8]
- Updated dependencies [51ec6a7a]
  - @shopify/prettier-plugin-liquid@1.6.3
  - @shopify/liquid-html-parser@2.2.0
  - @shopify/theme-check-common@3.4.0
  - @shopify/theme-language-server-browser@2.3.1
  - @shopify/theme-language-server-node@2.3.1

## 3.3.0

### Minor Changes

- 528127bd: Add theme block type completion in `{% schema %}`
- 5e8a2bfe: Add `SchemaPresetsBlockOrder` check
- 05ae5ea8: Added `MissingSchema` theme check to identify missing schemas in theme app extensions.
- 26215724: Add `EmptyBlockContent` Check
- 73758ba1: Add `LiquidFreeSettings` check
- 5e8a2bfe: Add `SchemaPresetsBlockOrder` check
- b2bad1f4: Add text edit completion of `{% content_for "block" %}`
- d1658353: Add filter completion support

  We'll now provide completions for Liquid filter parameters when requested.

### Patch Changes

- Updated dependencies
- Updated dependencies [05ae5ea8]
- Updated dependencies [3e69d732]
- Updated dependencies [26215724]
- Updated dependencies [73758ba1]
- Updated dependencies [5e8a2bfe]
- Updated dependencies [05b928ea]
- Updated dependencies [1f54be13]
- Updated dependencies [1083b2bc]
- Updated dependencies [a579d59e]
- Updated dependencies [5a2caaee]
- Updated dependencies [d2b5942a]
  - @shopify/prettier-plugin-liquid@1.6.2
  - @shopify/theme-check-common@3.3.0
  - @shopify/liquid-html-parser@2.1.2
  - @shopify/theme-language-server-browser@2.3.0
  - @shopify/theme-language-server-node@2.3.0

## 3.2.2

### Patch Changes

- Patch bump because it depends on:
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies [16e2f37]
  - @shopify/theme-check-common@3.2.2
  - @shopify/theme-language-server-browser@2.2.2
  - @shopify/theme-language-server-node@2.2.2

## 3.2.1

### Patch Changes

- Patch bump because it depends on:
  - @shopify/theme-language-server-browser
  - @shopify/theme-language-server-node
  - @shopify/theme-check-common
- Updated dependencies [4a18a78]
  - @shopify/theme-check-common@3.2.1
  - @shopify/theme-language-server-browser@2.2.1
  - @shopify/theme-language-server-node@2.2.1

## 3.2.0

### Minor Changes

- 3f7680e: Add the `ValidBlockTarget` Check
- 8a0bf78: Add the `ValidLocalBlocks` Check
- c4813ff: Add the `BlockIdUsage` check
- b558bfe: Fixup `CaptureOnContentForBlock` check

### Patch Changes

- f09c923: Preload theme files on file open instead of on rename
- 7317830: Add translation checking to `ValidSchemaName` check
- Updated dependencies
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
  - @shopify/prettier-plugin-liquid@1.6.1
  - @shopify/theme-check-common@3.2.0
  - @shopify/liquid-html-parser@2.1.1
  - @shopify/theme-language-server-browser@2.2.0
  - @shopify/theme-language-server-node@2.2.0

## 3.1.0

### Minor Changes

- bae0653: Do not activate language server for non-theme files
- 4a875bb: Add babel prettier plugin manually to fix the formatting in web version of the extension (Thanks @Smintfy)
- b431db7: Add `ValidateSchemaName` check
- 568d53b: Support for the `content_for` Liquid tag
- 8f3bc18: Add "block" or "blocks" completion for the `content_for` Liquid tag (Thanks @Smintfy)
- 6014dfd: Support metafield auto-completion based on .shopify/metafields.json file
- Updated dependencies
  - @shopify/theme-check-common@3.1.0
  - @shopify/liquid-html-parser@2.1.0
  - @shopify/prettier-plugin-liquid@1.6.0
  - @shopify/theme-language-server-browser@2.1.0
  - @shopify/theme-language-server-node@2.1.0

## 3.0.0

### Major Changes

- 4b574c1: Add support for virtual file systems

  The Shopify Liquid VS Code extension now works in a large set of new environments:

  - Remote files
  - Git backed files
  - VS Code for the Web

- 4b574c1: [BREAKING] Remove support for ruby language server

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
- Updated dependencies [4b574c1]
- Updated dependencies [5fab0e9]
- Updated dependencies [4b574c1]
  - @shopify/theme-check-common@3.0.0
  - @shopify/theme-language-server-browser@2.0.0
  - @shopify/theme-language-server-node@2.0.0

## 2.6.0

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

### Patch Changes

- @shopify/theme-language-server-node@1.14.0

## 2.5.1

### Patch Changes

- Fix missing close tag auto-insertion inside Liquid else branches
  - @shopify/liquid-html-parser
  - @shopify/theme-language-server-node
- Updated dependencies
- Updated dependencies [c664d52]
  - @shopify/prettier-plugin-liquid@1.5.2
  - @shopify/liquid-html-parser@2.0.5
  - @shopify/theme-language-server-node@1.13.1

## 2.5.0

### Minor Changes

- d1f9fef: Add support for HTML Element close tag auto-insertion

  ```liquid
  {% # type this %}
  <div>
  {% # get this, with cursor at | %}
  <div>|</div>
  ```

- d1f9fef: Add proper HTML tag `onEnterRules`

  ```liquid
  {% # type this, then press enter %}
  <div>|</div>

  {% # you get this, with cursor at | %}
  <div>|</div>
  ```

- b5a2fbc: Add HTML element name rename support

  Press `F2` on an HTML element name to rename its open/close pairs in a safe manner. No setting required.

  ```liquid
  {% # before rename %}
  <div>
    {% # press F2 on this `div` and have both the open and close parts be renamed at the same time %}
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

- a946a4e: Add tupled highlighting of HTML element names and Liquid blocks

  When you hover over a HTML tag open, the close tag is highlighted and vice-versa.

  ```liquid
  <div>
    {% # this div gets highlighted %}
    <div></div>
  </div>
  {% # with this one %}
  ```

  When you hover over a Liquid block open, the close block is highlighted (and branches if any).

  ```liquid
  {% # this if, elsif, else, endif all get highlighted together %}
  {% if cond %}
  {% elsif cond %}

  {% else %}

  {% endif %}
  ```

- 474b859: Add linked editing support for HTML element names

  Just like for [HTML in VS Code](https://code.visualstudio.com/updates/v1_52#_html), this feature is enabled by the `editor.linkedEditing` VS Code setting:

  ```json
  "editor.linkedEditing": true
  ```

  When enabled, this will make it so you can rename open/close pairs as you are typing.

### Patch Changes

- Updated dependencies
- Updated dependencies [1c73710]
- Updated dependencies [d1f9fef]
- Updated dependencies [70e2241]
  - @shopify/prettier-plugin-liquid@1.5.1
  - @shopify/liquid-html-parser@2.0.4
  - @shopify/theme-language-server-node@1.13.0

## 2.4.3

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.12.1

## 2.4.2

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.12.0

## 2.4.0

### Minor Changes

- f6b0a20: Remove the trailing comma warning in those files, and associate theme JSON files with JSONC

### Patch Changes

- @shopify/theme-language-server-node@1.11.3

## 2.3.3

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.11.2

## 2.3.2

### Patch Changes

- Patch bump because it depends on @shopify/prettier-plugin-liquid
- Updated dependencies [a07a064]
  - @shopify/prettier-plugin-liquid@1.5.0

## 2.3.1

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.11.1

## 2.3.0

### Minor Changes

- Add support for Shopify/theme-liquid-docs JSON Schema manifests for automatically updated JSON schemas for various part of themes and theme app extensions

### Patch Changes

- e0031bb: Fix Theme App Extension context inference
- Updated dependencies [e0031bb]
- Updated dependencies [03b41e1]
  - @shopify/theme-language-server-node@1.11.0

## 2.2.1

### Patch Changes

- Add `ValidJSON` check and improve error reporting of JSON schema offenses

## 2.2.0

### Minor Changes

- 8e3c7e2: Add `t:` translation completion and hover support in section and theme block `{% schema %}` tags
- 8e3c7e2: Add Schema translation checking to `MatchingTranslations`

### Patch Changes

- 8e3c7e2: Make translation completion fuzzy
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
- 8e3c7e2: Fix offering of standard translations options when the default translation file is open
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
- Updated dependencies [8e3c7e2]
  - @shopify/theme-language-server-node@1.9.0

## 2.1.3

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.8.3

## 2.1.2

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.8.2

## 2.1.1

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

- 042f1e0: Add section schema and translation file JSON completion and hover support

  JSON object authoring and editing should be better in the following contexts:

  - `sections/*.liquid` `{% schema %}` bodies
  - `locales/*.json` files

  Hovering over any key in any translation file will show the path of the translation key (for easy copy and paste).

  Pluralized strings and `_html` support is baked into the feature.

- a9ae65f: Add Language Server and Theme Check support for checkout.liquid objects

### Patch Changes

- Updated dependencies [042f1e0]
- Updated dependencies [042f1e0]
- Updated dependencies [2a3bca1]
  - @shopify/theme-language-server-node@1.8.0
  - @shopify/prettier-plugin-liquid@1.4.4

## 2.0.4

### Patch Changes

- 84f9eda: Include docset fallbacks in the theme-check-docs-updater package

  For when a user’s Internet connection is down or https://raw.githubusercontent.com is not accessible.

  - @shopify/theme-language-server-node@1.7.7

## 2.0.3

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.7.6

## 2.0.2

### Patch Changes

- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/prettier-plugin-liquid@1.4.3
  - @shopify/liquid-html-parser@2.0.3
  - @shopify/theme-language-server-node@1.7.5

## 2.0.1

### Patch Changes

- Fix parsing of `}}` inside `{% %}` and vice-versa
- Bump lodash version

## 2.0.0

### Major Changes

- dcadbea: **Shopify Liquid VS Code and Theme Check 2.0**

  This new major version is the grand unification of Shopify theme developer tools.

  Going forward, all Language Server Protocol features (Intelligent Code Completion, hover documentation, theme checks, code navigation, etc.) will be shared with the Online Store Code Editor.

  This is the culmination of the major rewrite of our Ruby language server and linter to TypeScript.

  It includes a re-architecture of the linter and Language Server to work on a LiquidHTML AST.

  **Major changes:**

  - Hover documentation support
  - New completion providers
    - HTML tag, attribute and value
    - Theme, section and block settings
    - Theme translations
  - Improved Type System
  - Automatically updated
  - Polished auto-closing pair UX
  - Proper monorepo and VS Code workspace support
    - For those of you working on large projects
  - Comes with batteries included
    - No longer requires a Ruby installation
  - Bring your own checks and/or publish them to npm
  - Runs in browser too

### Patch Changes

- @shopify/theme-language-server-node@1.7.3

## 1.15.1

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
  - @shopify/theme-language-server-node@1.7.2
  - @shopify/prettier-plugin-liquid@1.4.1
  - @shopify/liquid-html-parser@2.0.1

## 1.15.0

### Minor Changes

- a780181: Improve support of unclosed HTML nodes inside conditional code

  The following code is now supported by the Liquid prettier plugin and the `"shopifyLiquid.themeCheckNextDevPreview"` VS Code setting.

  ```liquid
  <div>
    {% if is_accordion %}
      <details>
        <summary>
    {% else %}
      <h3>
    {% endif %}

    ... summary/header content ...

    {% if is_accordion %}
      </summary>
    {% else %}
      <a href='{{ bookmark }}'>
        <svg>
          ...
        </svg>
      </a>
      </h3>
    {% endif %}

    ... body content ...

    {% if is_accordion %}
      </details>
    {% endif %}
  </div>
  ```

  Code that doesn’t properly close across branches will be flagged by a new theme check: `UnclosedHTMLElement`. See [PR](https://github.com/Shopify/theme-tools/pull/254) for details.

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [636895f]
- Updated dependencies [636895f]
  - @shopify/prettier-plugin-liquid@1.4.0
  - @shopify/liquid-html-parser@2.0.0
  - @shopify/theme-language-server-node@1.7.1

## 1.14.0

### Minor Changes

- b05a6a8: Add support for the following Language Server configurations:

  - `themeCheck.checkOnOpen`
  - `themeCheck.checkOnSave`
  - `themeCheck.checkOnChange`

  This is mostly for backward compatibility and to not be annoying :)

### Patch Changes

- @shopify/theme-language-server-node@1.7.0

## 1.13.1

### Patch Changes

- 55fb6b8: Include `<` in the autocloseBefore character set

## 1.13.0

### Minor Changes

- a120393: Add better auto-closing UX for Liquid pairs

  - Type `{{` get `{{ | }}` (cursor at `|`)
  - Type `{{-` get `{{- | -}}`
  - Type `{%` get `{% | %}`
  - Type `{%-` get `{%- | -%}`
  - Add a `-` on one side, only that side is affected
  - See [PR](https://github.com/Shopify/theme-tools/pull/242) for video
  - Only for `shopifyLiquid.themeCheckNextDevPreview`

### Patch Changes

- @shopify/theme-language-server-node@1.6.0

## 1.12.1

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.5.1

## 1.12.0

### Minor Changes

- c6d9ef6: Add theme, section and block settings completion and hover support

### Patch Changes

- Updated dependencies
- Updated dependencies [78813ea]
- Updated dependencies [78813ea]
- Updated dependencies [78813ea]
  - @shopify/prettier-plugin-liquid@1.3.4
  - @shopify/theme-language-server-node@1.5.0
  - @shopify/liquid-html-parser@1.1.1

## 1.11.19

### Patch Changes

- Do not report `UnusedAssign` for variables starting with an underscore
- @shopify/theme-language-server-node@1.4.6

## 1.11.18

### Patch Changes

- Fix `MissingAsset` false positives for .css.liquid, .js.liquid and .scss.liquid files
- Fix false ParserBlockingScript reports for scripts of type module
  - @shopify/theme-language-server-node@1.4.5

## 1.11.17

### Patch Changes

- Patch bump because it depends on:
  - @shopify/liquid-html-parser
  - @shopify/theme-language-server-node
    - Fix hover, completion and `UndefinedObject` reporting of `{% increment var %}` and `{% decrement var %}`
    - Fix UnusedAssign false positives in raw-like nodes
- Updated dependencies
- Updated dependencies [0d71145]
  - @shopify/prettier-plugin-liquid@1.3.3
  - @shopify/liquid-html-parser@1.1.0
  - @shopify/theme-language-server-node@1.4.4

## 1.11.16

### Patch Changes

- Re-add `ignoreMissing` support to `MissingTemplate`
- Superfluous settings as warnings not errors
- Add blocks/ files contextual completion, hover and UndefinedObject support

## 1.11.15

### Patch Changes

- Fix snippet links and translation key exists reporting of repos with custom root
  - @shopify/theme-language-server-node@1.4.2

## 1.11.14

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.4.1

## 1.11.13

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.4.0

## 1.11.12

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.3.3

## 1.11.11

### Patch Changes

- Patch bump because it depends on @shopify/prettier-plugin-liquid
- Updated dependencies [bec7ee0]
  - @shopify/prettier-plugin-liquid@1.3.2

## 1.11.10

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.3.2

## 1.11.9

### Patch Changes

- Patch bump because it depends on @shopify/prettier-plugin-liquid
- Updated dependencies [328ba49]
  - @shopify/prettier-plugin-liquid@1.3.1

## 1.11.8

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.3.1
    - Replace `AssetUrlFilters` check with `RemoteAsset` check
    - Fix completion, hover and UndefinedObject reporting of `tablerowloop` and `forloop` variables
    - Fix available object list of Liquid object completion provider.

## 1.11.7

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.3.0
    - Adds Shopify Reference links at the bottom of Liquid Hover and Completion Items

## 1.11.6

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.2.1

## 1.11.5

### Patch Changes

- bcaf65c: Fixup prettier loadConfig cache problem

## 1.11.4

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
- Updated dependencies [380b273]
  - @shopify/theme-language-server-node@1.2.0

## 1.11.3

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
  - @shopify/theme-language-server-node@1.1.0

## 1.11.2

### Patch Changes

- da94dfe: Fixup missing dep
- Updated dependencies [da94dfe]
  - @shopify/theme-language-server-node@1.0.2

## 1.11.1

### Patch Changes

- Patch bump because it depends on @shopify/theme-language-server-node
- Updated dependencies [14b9ee2]
  - @shopify/theme-language-server-node@1.0.1

## 1.11.0

### Minor Changes

- Added Theme Check 2.0 dev preview behind `shopifyLiquid.themeCheckNextDevPreview` setting.

### Patch Changes

- Updated dependencies [f552d4d]
  - @shopify/prettier-plugin-liquid@1.3.0
  - @shopify/liquid-html-parser@1.0.0
  - @shopify/theme-language-server-node@1.0.0

## 1.10.0 / 2023-05-26

- Add posix sh command existence compliance ([#126](https://github.com/shopify/theme-check-vscode/issues/126))
- Bump to prettier-plugin-liquid v1.1.0 ([#129](https://github.com/shopify/theme-check-vscode/issues/129))

  Learn more in its [CHANGELOG](https://github.com/Shopify/prettier-plugin-liquid/blob/v1.1.0/CHANGELOG.md#110--2023-05-26).

## 1.9.7 / 2023-03-07

- Prioritize direct `theme-check` install over CLI install

## 1.9.6 / 2023-02-17

- Update Syntax Highlighting

## 1.9.5 / 2023-01-18

- Bump prettier-plugin-liquid to v1.0.6

## 1.9.4 / 2023-01-10

- Bump prettier-plugin-liquid to v1.0.5

## 1.9.3 / 2023-01-05

- Bump @shopify/prettier-plugin-liquid to v1.0.3

## 1.9.2 / 2023-01-04

- Bump syntax highlighting version

## 1.9.1 / 2023-01-04

- Bump syntax highlighting to add support for sections tag

## 1.9.0 / 2022-12-13

- Send diagnostics for LiquidPrettierPlugin parsing errors ([#106](https://github.com/shopify/theme-check-vscode/issues/106))
- Switch to TypeScript
- Upgrade syntaxes commit for node18 compat
- Add CI

## 1.8.0 / 2022-12-09

- Bump prettier-plugin-liquid to v1.0.0 :tada:
- Remove "shopifyLiquid.formatterDevPreview", it's no longer opt-in :)

## 1.7.4 / 2022-11-29

- Upgrade prettier plugin version to v1.0.0-rc.0

## 1.7.3 / 2022-11-24

- Upgrade prettier plugin version to v0.4.2

## 1.7.2 / 2022-11-22

- Upgrade prettier plugin version to 0.4.1
- Syntax highlighting update (stylesheet tag)

## 1.7.1 / 2022-11-01

- Fixes typo in config description
- Add troubleshooting doc

## 1.7.0 / 2022-09-09

- Bump prettier-plugin-liquid to version v0.4.0

## 1.6.0 / 2022-08-26

- Bump prettier-plugin-version to v0.3.0

## 1.5.0 / 2022-08-10

- Bump prettier plugin version to v0.2.1
- Syntax highlighting update (nested comments)

## 1.4.3 / 2022-05-27

- Add explicit dependency to @shopify/prettier-plugin-liquid

## 1.4.2 / 2022-05-27

- Fixup formatter extra character problem
- Stop treating .{s?css,js}.liquid files as liquid files

## 1.4.1 / 2022-05-25

- Fixup error handling

## 1.4.0 / 2022-05-25

- Use standard location for the Liquid grammar
- Add Liquid Formatting Developer Preview
  - Do the following to enable enable the preview:
    1. Set `"shopifyLiquid.formatterDevPreview"` to `true` in your VS Code `settings.json`
    2. Do any of the following:
    - Right-click in a `.liquid` file > `Format Document`
    - Select `Format Document` from the command palette (`cmd+p`)
    - Bind `Format Document` to a keyboard shortcut
    - Enable `formatOnSave` for Liquid files:
      ```
      "[liquid]": {
        "editor.defaultFormatter": "Shopify.theme-check-vscode",
        "editor.formatOnSave": true
      },
      ```

## 1.3.9 / 2022-02-24

- Document `themeCheck.onlySingleFileChecks` in the README as well.

## 1.3.8 / 2022-02-24

- Document `themeCheck.onlySingleFileChecks` configuration (theme-check v1.10.0+)

  Since v1.10.0, [theme-check](https://github.com/shopify/theme-check) is a bit smarter with `checkOnChange`.

  Instead of rerunning all the checks that span multiple files (UnusedSnippet, TranslationKeyExists, etc.), it only reruns single file checks for the file being changed and merges the result with the previous whole theme checks. **This makes `textDocument/didChange` checks happen ~125x faster (~1250ms -> 10ms).**

  If you want this speed increase all the time (at the cost of ignoring whole theme checks during development), now you can by setting `themeCheck.onlySingleFileChecks` to `true` in your VS Code's `config.json`.

## 1.3.7 / 2022-02-15

- Fix syntax highlighting after `{%- endstyle %}`

## 1.3.6 / 2022-02-10

- Fixup raw tag highlighting with whitespace stripping characters

## 1.3.5 / 2022-02-10

- Fixup highlighting of whitespace stripping comments

## 1.3.4 / 2022-02-09

- Fixup highlighting of raw and comment tags inside injections

## 1.3.3 / 2022-02-08

- Fixup highlighting of liquid tag comment blocks

## 1.3.2 / 2022-02-04

- Fixup bracket coloring inside embedded languages [#67](https://github.com/shopify/theme-check-vscode/issues/67)

## 1.3.1 / 2022-02-04

- Fix annoying `{%--%} %}` autoclose issue ([#65](https://github.com/shopify/theme-check-vscode/issues/65))
- Add support for `editor.bracketPairColorization.enabled` ([#62](https://github.com/shopify/theme-check-vscode/issues/62))

## 1.3.0 / 2022-02-01

- Syntax highlighting overhaul ([#61](https://github.com/shopify/theme-check-vscode/issues/61))

## 1.2.0 / 2021-12-01

- Overdue updates
  - Document new LanguageServer configurations.
  - Add way to opt out of annoying Windows warning.
  - Improve the `activationEvents` (only folders with .theme-check.yml or onLanguage:liquid will start the extension)
  - Add new "Shopify Theme Check: Run checks" command to manually run checks (for those that turn off all the checkOn\* configs)

## 1.1.5 / 2021-09-07

- Fix date typo in CHANGELOG.

## 1.1.4 / 2021-09-07

- Fix the where command for Windows (select the .bat file)

## 1.1.3 / 2021-08-23

- Add Windows experimental warning in editor
- Disable `shopify theme language-server` on Windows until we fix the upstream bug (See ([#42](https://github.com/shopify/theme-check-vscode/issues/42)))

## 1.1.2 / 2021-08-16

- Put Windows warning on README.
- Bump path-parse from 1.0.6 to 1.0.7

## 1.1.0 / 2021-07-15

- Add Windows support

## 1.0.0 / 2021-06-29

- v1.0.0
- Add Shopify CLI as recommended installation method

## 0.3.2 / 2021-06-29

- Rename from Theme Check -> Shopify Liquid
- Add Syntax Highlighting
- Add fancy README

## 0.2.0 / 2021-03-15

- Add Language Configuration
  - Auto closing `{%`, `{{`, `{%-`, `{{-`, `<`, ...
  - Indentation rules
  - Block comment with `{% comment %}` `{% endcomment %}`
- Upgrade `vscode-languageclient` to v7.0.0 to support link to diagnostic documentation

## 0.1.5 / 2021-02-11

- Add onDidChangeConfiguration handler
- Add restart server command
- Fix links in README

## 0.1.4 / 2021-01-28

- Listen to changes in json files (for translations)
- Fixup typo in config

## 0.1.2 / 2021-01-22

- Change activationEvent to onStartupFinished. :crossed_fingers:

## 0.1.1 / 2021-01-22

- Fix issue with vsix package on the VS Code Marketplace.
