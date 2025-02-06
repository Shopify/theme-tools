# @shopify/liquid-html-parser

## 2.4.0

### Minor Changes

- e57979e0: Add parsing and prettier support for example node in liquiddoc
  Example:

  ```liquid
  {% doc %}
    @example
    Here is my content
  {% enddoc %}
  ```

- 8c9f5bcf: Add parsing support for optional param delimiters `[]`.
  Parameters with `[]` around a valid param name will be considered optional.
  Param names can be any alphanumeric character, `-`, or `_`.

## 2.3.2

### Patch Changes

- 841ca6d1: Update repository URL for all packages to be case sensitive

## 2.3.1

### Patch Changes

- dd0cd4d2: [Internal] Modify paramDescription to be null when empty

## 2.3.0

### Minor Changes

- ac55577a: Add prettier support for LiquidDoc {% doc %} tag and @param annotation

## 2.2.0

### Minor Changes

- 8912fab8: Update Ohm grammar for ContentFor tag to extract arguments correctly
  Update ValidContentForArguments check to report deprecated context. argument usage

## 2.1.2

### Minor Changes

- 1f54be13: Add support for incomplete filter statements

  Adds the ability to continue to parse liquid code that would otherwise be
  considered invalid:

  ```liquid
  {{ product | image_url: width: 100, c█ }}
  ```

  The above liquid statement will now successfully parse in all placeholder modes
  so that we can offer completion options for filter parameters.

## 2.1.1

### Patch Changes

- c4813ff: Fix LiquidComparison types

## 2.1.0

### Minor Changes

- 568d53b: Add support for the `content_for` Liquid tag

## 2.0.5

### Patch Changes

- c664d52: LiquidBranch nodes should always report a blockEndPosition of 0 length

## 2.0.4

### Patch Changes

- 1c73710: Fix bug where whitespace stripping character was assigned to variable
- d1f9fef: (Internal) Add `unclosed` node information to LiquidHTMLASTError
- 70e2241: Fix broken parsing of liquid attribute names

## 2.0.3

### Patch Changes

- 0990c47: Fix config validation problem that required optional settings
- 617b766: Add parser support for trailing commas at the end of Liquid tags and filters

## 2.0.2

### Patch Changes

- fa02f1b: Fix parsing of `}}` inside `{% %}` and vice-versa

## 2.0.1

### Patch Changes

- 8451075: `package.json` and README cleanups

## 2.0.0

### Major Changes

- 636895f: Add support for unclosed HTML Element nodes inside branching code

  **Breaking changes**

  - `HtmlDanglingMarkerOpen` nodes are folded into `HtmlElement` nodes

    - You can identify a node without its closing tag by looking at `blockEndPosition`

      ```js
      node.source.slice(node.blockEndPosition.start, node.blockEndPosition.end) === '';
      ```

  **Why the change**?

  - `HtmlDanglingMarkerOpen` nodes did not have children, since we added support for nodes without closing markers, we removed that node type entirely.

### Minor Changes

- 636895f: Allow 'HtmlDanglingMarkerClose' nodes to have non-dangling marker siblings

## 1.1.1

### Patch Changes

- 78813ea: Add internal-use property to DocumentNode

## 1.1.0

### Minor Changes

- 0d71145: Add `nodes` property to RawMarkupKind to allow for subtree visiting

  - Partially breaking in the sense where Liquid (not LiquidHTML) syntax errors will be reported from within scripts, styles, and JSON blobs

## 1.0.0

### Major Changes

- 02f4731: Hello world
