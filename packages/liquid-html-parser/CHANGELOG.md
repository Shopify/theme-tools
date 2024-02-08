# @shopify/liquid-html-parser

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
