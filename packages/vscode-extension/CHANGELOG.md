## theme-check-vscode

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
