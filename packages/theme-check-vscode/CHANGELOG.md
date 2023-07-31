
1.10.0 / 2023-05-26
===================

  * Add posix sh command existence compliance ([#126](https://github.com/shopify/theme-check-vscode/issues/126))
  * Bump to prettier-plugin-liquid v1.1.0 ([#129](https://github.com/shopify/theme-check-vscode/issues/129))

    Learn more in its [CHANGELOG](https://github.com/Shopify/prettier-plugin-liquid/blob/v1.1.0/CHANGELOG.md#110--2023-05-26).

1.9.7 / 2023-03-07
==================

  * Prioritize direct `theme-check` install over CLI install

1.9.6 / 2023-02-17
==================

  * Update Syntax Highlighting

1.9.5 / 2023-01-18
==================

  * Bump prettier-plugin-liquid to v1.0.6

1.9.4 / 2023-01-10
==================

  * Bump prettier-plugin-liquid to v1.0.5

1.9.3 / 2023-01-05
==================

  * Bump @shopify/prettier-plugin-liquid to v1.0.3

1.9.2 / 2023-01-04
==================

  * Bump syntax highlighting version

1.9.1 / 2023-01-04
==================

  * Bump syntax highlighting to add support for sections tag

1.9.0 / 2022-12-13
==================

  * Send diagnostics for LiquidPrettierPlugin parsing errors ([#106](https://github.com/shopify/theme-check-vscode/issues/106))
  * Switch to TypeScript
  * Upgrade syntaxes commit for node18 compat
  * Add CI

1.8.0 / 2022-12-09
==================

  * Bump prettier-plugin-liquid to v1.0.0 :tada:
  * Remove "shopifyLiquid.formatterDevPreview", it's no longer opt-in :)

1.7.4 / 2022-11-29
==================

  * Upgrade prettier plugin version to v1.0.0-rc.0

1.7.3 / 2022-11-24
==================

  * Upgrade prettier plugin version to v0.4.2

1.7.2 / 2022-11-22
==================

  * Upgrade prettier plugin version to 0.4.1
  * Syntax highlighting update (stylesheet tag)

1.7.1 / 2022-11-01
==================

  * Fixes typo in config description
  * Add troubleshooting doc

1.7.0 / 2022-09-09
==================

  * Bump prettier-plugin-liquid to version v0.4.0

1.6.0 / 2022-08-26
==================

  * Bump prettier-plugin-version to v0.3.0

1.5.0 / 2022-08-10
==================

  * Bump prettier plugin version to v0.2.1
  * Syntax highlighting update (nested comments)

1.4.3 / 2022-05-27
==================

  * Add explicit dependency to @shopify/prettier-plugin-liquid

1.4.2 / 2022-05-27
==================

  * Fixup formatter extra character problem
  * Stop treating .{s?css,js}.liquid files as liquid files

1.4.1 / 2022-05-25
==================

  * Fixup error handling

1.4.0 / 2022-05-25
==================

  * Use standard location for the Liquid grammar
  * Add Liquid Formatting Developer Preview
    * Do the following to enable enable the preview:
      1. Set `"shopifyLiquid.formatterDevPreview"` to `true` in your VS Code `settings.json`
      2. Do any of the following:
        * Right-click in a `.liquid` file > `Format Document`
        * Select `Format Document` from the command palette (`cmd+p`)
        * Bind `Format Document` to a keyboard shortcut
        * Enable `formatOnSave` for Liquid files:
          ```
          "[liquid]": {
            "editor.defaultFormatter": "Shopify.theme-check-vscode",
            "editor.formatOnSave": true
          },
          ```

1.3.9 / 2022-02-24
==================

  * Document `themeCheck.onlySingleFileChecks` in the README as well.

1.3.8 / 2022-02-24
==================

  * Document `themeCheck.onlySingleFileChecks` configuration (theme-check v1.10.0+)

    Since v1.10.0, [theme-check](https://github.com/shopify/theme-check) is a bit smarter with `checkOnChange`.

    Instead of rerunning all the checks that span multiple files (UnusedSnippet, TranslationKeyExists, etc.), it only reruns single file checks for the file being changed and merges the result with the previous whole theme checks. **This makes `textDocument/didChange` checks happen ~125x faster (~1250ms -> 10ms).**

    If you want this speed increase all the time (at the cost of ignoring whole theme checks during development), now you can by setting `themeCheck.onlySingleFileChecks` to `true` in your VS Code's `config.json`.

1.3.7 / 2022-02-15
==================

  * Fix syntax highlighting after `{%- endstyle %}`

1.3.6 / 2022-02-10
==================

  * Fixup raw tag highlighting with whitespace stripping characters

1.3.5 / 2022-02-10
==================

  * Fixup highlighting of whitespace stripping comments

1.3.4 / 2022-02-09
==================

  * Fixup highlighting of raw and comment tags inside injections

1.3.3 / 2022-02-08
==================

  * Fixup highlighting of liquid tag comment blocks

1.3.2 / 2022-02-04
==================

  * Fixup bracket coloring inside embedded languages [#67](https://github.com/shopify/theme-check-vscode/issues/67)

1.3.1 / 2022-02-04
==================

  * Fix annoying `{%--%} %}` autoclose issue ([#65](https://github.com/shopify/theme-check-vscode/issues/65))
  * Add support for `editor.bracketPairColorization.enabled` ([#62](https://github.com/shopify/theme-check-vscode/issues/62))

1.3.0 / 2022-02-01
==================

  * Syntax highlighting overhaul ([#61](https://github.com/shopify/theme-check-vscode/issues/61))

1.2.0 / 2021-12-01
==================

  * Overdue updates
    - Document new LanguageServer configurations.
    - Add way to opt out of annoying Windows warning.
    - Improve the `activationEvents` (only folders with .theme-check.yml or onLanguage:liquid will start the extension)
    - Add new "Shopify Theme Check: Run checks" command to manually run checks (for those that turn off all the checkOn* configs)

1.1.5 / 2021-09-07
==================

  * Fix date typo in CHANGELOG.

1.1.4 / 2021-09-07
==================

  * Fix the where command for Windows (select the .bat file)

1.1.3 / 2021-08-23
==================

  * Add Windows experimental warning in editor
  * Disable `shopify theme language-server` on Windows until we fix the upstream bug (See ([#42](https://github.com/shopify/theme-check-vscode/issues/42)))

1.1.2 / 2021-08-16
==================

  * Put Windows warning on README.
  * Bump path-parse from 1.0.6 to 1.0.7

1.1.0 / 2021-07-15
==================

  * Add Windows support

1.0.0 / 2021-06-29
==================

  * v1.0.0
  * Add Shopify CLI as recommended installation method

0.3.2 / 2021-06-29
==================

  * Rename from Theme Check -> Shopify Liquid
  * Add Syntax Highlighting
  * Add fancy README

0.2.0 / 2021-03-15
==================

  * Add Language Configuration
    * Auto closing `{%`, `{{`, `{%-`, `{{-`, `<`, ...
    * Indentation rules
    * Block comment with `{% comment %}` `{% endcomment %}`
  * Upgrade `vscode-languageclient` to v7.0.0 to support link to diagnostic documentation

0.1.5 / 2021-02-11
==================

  * Add onDidChangeConfiguration handler
  * Add restart server command
  * Fix links in README

0.1.4 / 2021-01-28
==================

  * Listen to changes in json files (for translations)
  * Fixup typo in config

0.1.2 / 2021-01-22
==================

  * Change activationEvent to onStartupFinished. :crossed_fingers:

0.1.1 / 2021-01-22
==================

  * Fix issue with vsix package on the VS Code Marketplace.
