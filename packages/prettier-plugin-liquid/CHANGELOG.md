# @shopify/prettier-plugin-liquid

## 1.9.2

### Patch Changes

- 7ff54f02: Remove dead code
- Updated dependencies [7ff54f02]
  - @shopify/liquid-html-parser@2.8.1

## 1.9.1

### Patch Changes

- 1a95a190: Introduce parsing support for a `@prompt` annotation within `{% doc %}` tags
- Updated dependencies [1a95a190]
  - @shopify/liquid-html-parser@2.8.0

## 1.9.0

### Minor Changes

- 8ff89592: Adjust LiquidDoc formatting rules for single-line and multi-line examples and descriptions

  - Multi-line content starts on a new line
  - Single-line content is kept on the same line or a new line as it was provided

### Patch Changes

- Updated dependencies [de877551]
  - @shopify/liquid-html-parser@2.7.0

## 1.8.3

### Patch Changes

- 9563715a: Add padding for liquid doc content
- 357ea7fc: Prevent prettier from appending `@description` annotation before implicit descriptions
- Updated dependencies [10493c9d]
- Updated dependencies [79c9f773]
- Updated dependencies [9563715a]
  - @shopify/liquid-html-parser@2.6.0

## 1.8.2

### Patch Changes

- 085aabbe: Add prettier support for the `@description` tag

## 1.8.1

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [c4bbf3b5]
- Updated dependencies [d9dbc265]
- Updated dependencies [2db3047f]
- Updated dependencies [261c2958]
  - @shopify/liquid-html-parser@2.5.0

## 1.8.0

### Minor Changes

- e57979e0: Add parsing and prettier support for example node in liquiddoc
  Example:

  ```liquid
  {% doc %}
    @example
    Here is my content
  {% enddoc %}
  ```

- 357feaa8: Add formatting support for optional liquidDoc parameters (e.g. `@param [optional-parameter] - paramDescription`).
  Whitespace is now stripped around the parameter name and the optional delimiters.

### Patch Changes

- Updated dependencies [e57979e0]
- Updated dependencies [8c9f5bcf]
  - @shopify/liquid-html-parser@2.4.0

## 1.7.2

### Patch Changes

- 841ca6d1: Update repository URL for all packages to be case sensitive
- Updated dependencies [841ca6d1]
  - @shopify/liquid-html-parser@2.3.2

## 1.7.1

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [dd0cd4d2]
  - @shopify/liquid-html-parser@2.3.1

## 1.7.0

### Minor Changes

- ac55577a: Add prettier support for LiquidDoc {% doc %} tag and @param annotation

### Patch Changes

- Updated dependencies [ac55577a]
  - @shopify/liquid-html-parser@2.3.0

## 1.6.3

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [8912fab8]
  - @shopify/liquid-html-parser@2.2.0

## 1.6.2

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [1f54be13]
  - @shopify/liquid-html-parser@2.1.2

## 1.6.1

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [c4813ff]
  - @shopify/liquid-html-parser@2.1.1

## 1.6.0

### Minor Changes

- 568d53b: Add support for the `content_for` Liquid tag

### Patch Changes

- Updated dependencies [568d53b]
  - @shopify/liquid-html-parser@2.1.0

## 1.5.2

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [c664d52]
  - @shopify/liquid-html-parser@2.0.5

## 1.5.1

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [1c73710]
- Updated dependencies [d1f9fef]
- Updated dependencies [70e2241]
  - @shopify/liquid-html-parser@2.0.4

## 1.5.0

### Minor Changes

- a07a064: Add `captureWhitespaceSensitivity` configuration option.

  - When `strict` (default), behaves as before: treats the child nodes of `{% capture var %}` child nodes as strictly whitespace sensitive, therefore does not reformat contents.
  - When `ignore` (new), makes it behave like tags that are not whitespace sensitive. Warning: blindly running this will alter the string value of variables captured by the capture tag.

  ```liquid
  {% # with captureWhitespaceSensitivity: ignore %}

  {% # input %}
  {% capture var %}
  {% for x in y %}
  {{ x }}
  {% endfor %}
  {% endcapture %}

  {% # output %}
  {% capture var %}
    {% for x in y %}
      {{ x }}
    {% endfor %}
  {% endcapture %}
  ```

  Thank you @stijns96 for this feature!

## 1.4.4

### Patch Changes

- 2a3bca1: Fix pretty printing of keys that start with numbers

## 1.4.3

### Patch Changes

- 0990c47: Fix config validation problem that required optional settings
- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters
- Updated dependencies [0990c47]
- Updated dependencies [617b766]
  - @shopify/liquid-html-parser@2.0.3

## 1.4.2

### Patch Changes

- fa02f1b: Fix parsing of `}}` inside `{% %}` and vice-versa
- Updated dependencies [fa02f1b]
  - @shopify/liquid-html-parser@2.0.2

## 1.4.1

### Patch Changes

- 8451075: `package.json` and README cleanups
- Updated dependencies [8451075]
  - @shopify/liquid-html-parser@2.0.1

## 1.4.0

### Minor Changes

- 636895f: Allow 'HtmlDanglingMarkerClose' nodes to have non-dangling marker siblings
- 636895f: Add support for unclosed HTML nodes inside branching code

  The following code is now supported by the formatter:

  ```liquid
  {% if cond %}
    <details>
      <summary>...</summary>
  {% endif %}
  ```

  To follow: a linting rule that warns you if the pairs are unbalanced.

### Patch Changes

- Updated dependencies [636895f]
- Updated dependencies [636895f]
  - @shopify/liquid-html-parser@2.0.0

## 1.3.4

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [78813ea]
  - @shopify/liquid-html-parser@1.1.1

## 1.3.3

### Patch Changes

- Patch bump because it depends on @shopify/liquid-html-parser
- Updated dependencies [0d71145]
  - @shopify/liquid-html-parser@1.1.0

## 1.3.2

### Patch Changes

- bec7ee0: Fix idempotence of script tag bodies with both backticks and Liquid in them

## 1.3.1

### Patch Changes

- 328ba49: Fix cursorOffset bug with prettier 3

## 1.3.0

### Minor Changes

- 25b79f0: Rename LiquidDrop -> LiquidVariableLookup

### Patch Changes

- f552d4d: Fixup the position of LiquidBranch nodes
- Updated dependencies [02f4731]
  - @shopify/liquid-html-parser@1.0.0

## 1.2.3

### Patch Changes

- 5479a63: Fix node location bug in {% liquid %}
- 5479a63: Add placeholder support in in tags and attributes

## 1.2.2 / 2023-07-18

- Fixup mode passing in toLiquidHtmlAst
- Fixup toAttributePosition with array name (empty string)
- Add RAW_TAGS constant in parser/grammar.ts

## 1.2.1 / 2023-07-12

- Add `|| prettier@^3` `peerDependencies` to package.json...
- Update README to account for prettier@3 breaking changes

## 1.2.0 / 2023-07-12

- Add support for `prettier@^3` (in _addition_ to `prettier@^2`) ([#196](https://github.com/shopify/prettier-plugin-liquid/issues/196))
- Add `completion` mode to the parser ([#195](https://github.com/shopify/prettier-plugin-liquid/issues/195))

## 1.1.0 / 2023-05-26

- Add support for Strict Liquid Markup parsing ([#187](https://github.com/shopify/prettier-plugin-liquid/issues/187))
- Add support for dangling HTML nodes inside Liquid if statements ([#186](https://github.com/shopify/prettier-plugin-liquid/issues/186))

  That is, the following liquid code _no longer_ throws a LiquidHTMLParsingError

  ```liquid
  <div>
    {% if href %}
      <a href='{{ href }}'>
    {% endif %}

    <div class='content-wrapper'>
      <p>...</p>
    </div>

    {% if href %}
      </a>
    {% endif %}
  </div>
  ```

  The heuristic we're going for is the following:

  - Only supported inside a LiquidBranch (if,else,when)
  - At most 2 of the same type (2 dangling open, or 2 dangling close)

  Everything else still throws a LiquidHTMLParsingError. The idea is that those are likely errors, whereas the heuristic isn't.

## 1.0.6 / 2023-01-18

- Maintain at most 1 newline between tag attributes ([#159](https://github.com/shopify/prettier-plugin-liquid/issues/159))

## 1.0.5 / 2023-01-10

- Allow for nested HTML raw tags ([#157](https://github.com/shopify/prettier-plugin-liquid/issues/157))

## 1.0.4 / 2023-01-10

- Fix `{% paginate %}` parsing error ([#155](https://github.com/shopify/prettier-plugin-liquid/issues/155))

## 1.0.3 / 2023-01-04

### Features

- Add support for sections tag

## 1.0.2 / 2022-12-13

### Fixes

- Emit declaration files

## 1.0.1 / 2022-12-13

### Fixes

- Fix trailing whitespace after opening raw tag breaking formatting ([#145](https://github.com/shopify/prettier-plugin-liquid/issues/145))
- Add typings for standalone.js

## 1.0.0 / 2022-12-09

:tada: The Liquid prettier plugin is now officially ready for production!

Astute devs might have noticed that it is also enabled inside [Shopify's Online Store Code Editor](https://shopify.dev/themes/tools/code-editor#formatting-theme-code).

### Features

- Stability :)
- No major changes
- Compatible with `v0.4`

### Fixes

- Add support for `<!-- white-space: normal -->` comment ([#142](https://github.com/shopify/prettier-plugin-liquid/issues/142))
- Fix parsing error messages ([#143](https://github.com/shopify/prettier-plugin-liquid/issues/143))

## 1.0.0-rc.3 / 2022-12-07

### Fixes

- Top level unclosed tags should throw errors ([#140](https://github.com/shopify/prettier-plugin-liquid/issues/140))
- Change README production notice to production-ready :)

## 1.0.0-rc.2 / 2022-12-06

### Fixes

- Maintain at most 1 newline between Liquid branches ([#137](https://github.com/shopify/prettier-plugin-liquid/issues/137))
- Parse smart quotes as dumb quotes to prevent formatted copy pasting errors ([#130](https://github.com/shopify/prettier-plugin-liquid/issues/130))
- Add support for compound Liquid + HTML element names ([#128](https://github.com/shopify/prettier-plugin-liquid/issues/128))
  - e.g. `<h{{ header_number}}></h{{ header_number }}>`

## 1.0.0-rc.1 / 2022-12-02

### Fixes

- Fix parsing of LiquidDrop in HTML attribute names (`<a data-popup--{{ id }}="...">`) ([#101](https://github.com/shopify/prettier-plugin-liquid/issues/101))
- Fix parsing of unquoted LiquidDrop HTML attributes (`<a id={{ id }}--omg>`) ([#101](https://github.com/shopify/prettier-plugin-liquid/issues/101))
- Fix parsing of tags with missing space between whitespace stripping and tag name (`{% else-%}`) ([#126](https://github.com/shopify/prettier-plugin-liquid/issues/126))

## 1.0.0-rc.0 / 2022-11-29

### Features

- It's supposed to be stable now :)
- Add support for `prettier-ignore-attributes` ([#125](https://github.com/shopify/prettier-plugin-liquid/issues/125))

### Fixes

- Fix secondary templating parsing issue ([#125](https://github.com/shopify/prettier-plugin-liquid/issues/125))

## 0.4.3 / 2022-11-25

- Fix IE conditional comments formatting ([#122](https://github.com/shopify/prettier-plugin-liquid/issues/122))

## 0.4.2 / 2022-11-24

- Fix the formatting of HTML tags with one attribute that is multiline ([#121](https://github.com/shopify/prettier-plugin-liquid/issues/121))

## 0.4.1 / 2022-11-22

- Fix support of legacy HTML doctypes. ([#96](https://github.com/shopify/prettier-plugin-liquid/issues/96), [#102](https://github.com/shopify/prettier-plugin-liquid/issues/102))
- Fix unnecessary whitespace stripping on liquid html attribute break ([#102](https://github.com/shopify/prettier-plugin-liquid/issues/102))
- Fix indentation sensitivity of `{% capture %}` tag. ([#114](https://github.com/shopify/prettier-plugin-liquid/issues/114))
- Fix `useTabs` bugs ([#89](https://github.com/shopify/prettier-plugin-liquid/issues/89), [#114](https://github.com/shopify/prettier-plugin-liquid/issues/114))
- Add missing support for `{% stylesheet %}` tag ([#117](https://github.com/shopify/prettier-plugin-liquid/issues/117))
- Add missing support for nested comments ([#108](https://github.com/shopify/prettier-plugin-liquid/issues/108))

## 0.4.0 / 2022-09-09

### Features

- Add support for the `{% liquid %}` tag ([#94](https://github.com/shopify/prettier-plugin-liquid/issues/94))
- Add support for embedded languages ([#88](https://github.com/shopify/prettier-plugin-liquid/issues/88))
  - Use prettier's JavaScript formatter inside `<script>` and `{% javascript %}` tags
  - Use prettier's CSS formatter inside `<style>` and `{% style %}` tags
  - Use prettier's JSON formatter inside `<script type="anything/that-ends-in-json">` and `{% schema %}` tags
  - Use prettier's Markdown formatter inside `<script type="text/markdown">`
  - Add a new configuration: `embeddedSingleQuote` to control the `singleQuote` property of embedded languages
    - When `true` (default), will prefer single quotes inside embedded JS & CSS

### Fixes

- Fix grammar precedence (>=, <=) for operators in conditionals ([#98](https://github.com/shopify/prettier-plugin-liquid/issues/98))

## 0.3.1 / 2022-08-31

- Fixup printing of failed-to-parse Liquid ([#95](https://github.com/shopify/prettier-plugin-liquid/issues/95))

## 0.3.0 / 2022-08-26

### Features

- Add [online playground](https://shopify.github.io/prettier-plugin-liquid/) ([#86](https://github.com/shopify/prettier-plugin-liquid/issues/86))
- Add support for `{% # prettier-ignore %}` ([#85](https://github.com/shopify/prettier-plugin-liquid/issues/85))
- Add support for the `assign` tag ([#54](https://github.com/shopify/prettier-plugin-liquid/issues/54))
- Add support for the `echo` liquid tag ([#54](https://github.com/shopify/prettier-plugin-liquid/issues/54))
- Add support for the `section` tag ([#73](https://github.com/shopify/prettier-plugin-liquid/issues/73))
- Add support for the `if`, `elsif` and `unless` tags ([#77](https://github.com/shopify/prettier-plugin-liquid/issues/77))
- Add support for the `render` and `include` tags ([#56](https://github.com/shopify/prettier-plugin-liquid/issues/56))
- Add support for the `form` tag ([#75](https://github.com/shopify/prettier-plugin-liquid/issues/75))
- Add support for the `capture` open tag parsing ([#84](https://github.com/shopify/prettier-plugin-liquid/issues/84))
- Add support for the `case` and `when` tag ([#78](https://github.com/shopify/prettier-plugin-liquid/issues/78))
- Add support for the `cycle` tag ([#81](https://github.com/shopify/prettier-plugin-liquid/issues/81))
- Add support for the `for` tag ([#79](https://github.com/shopify/prettier-plugin-liquid/issues/79))
- Add support for the `increment` and `decrement` tags ([#82](https://github.com/shopify/prettier-plugin-liquid/issues/82))
- Add support for the `layout` tag ([#80](https://github.com/shopify/prettier-plugin-liquid/issues/80))
- Add support for the `paginate` tag ([#76](https://github.com/shopify/prettier-plugin-liquid/issues/76))
- Add support for the `tablerow` tag ([#79](https://github.com/shopify/prettier-plugin-liquid/issues/79))
- Prefer `null` over `nil`
- Strip markup from tags that don't take arguments

## 0.2.1 / 2022-08-10

- Add partial support for Liquid inside YAML frontmatter ([#71](https://github.com/Shopify/prettier-plugin-liquid/issues/71))

## 0.2.0 / 2022-08-08

### Features

- Adds pretty-printing of Liquid objects and filters ([#41](https://github.com/Shopify/prettier-plugin-liquid/pull/41) and [#46](https://github.com/Shopify/prettier-plugin-liquid/pull/46))
- Adds the `liquidSingleQuote` configuration option
  - Prefer single quotes inside Liquid strings
  - `true` by default

### Fixes

- Add YAML frontmatter support ([#29](https://github.com/Shopify/prettier-plugin-liquid/issues/29))
- Fix custom-element parsing ([#37](https://github.com/Shopify/prettier-plugin-liquid/issues/37)) (Thank you @qw-in!)

## 0.1.4 / 2022-06-02

- Add support for Liquid inline comments (`{% # hello world %}`) [#28](https://github.com/Shopify/prettier-plugin-liquid/pull/28)
- Fix support of attribute names to be spec-compliant (e.g. AlpineJS attributes) [#27](https://github.com/Shopify/prettier-plugin-liquid/pull/27)

## 0.1.3 / 2022-05-31

- Micro refactor of node.isLeadingWhitespaceSensitive && !node.hasLeadingWhitespace
- Add gif to README

## 0.1.2 / 2022-05-30

- Public access
- Fixup reindent bug

## 0.1.1 / 2022-05-30

- theme-check compatible defaults

## 0.1.0 / 2022-05-27

- Initial release
