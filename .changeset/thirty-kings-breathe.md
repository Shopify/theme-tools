---
'@shopify/liquid-html-parser': major
---

Add support for unclosed HTML Element nodes inside branching code

**Breaking changes**

- `HtmlDanglingMarkerOpen` nodes are folded into `HtmlElement` nodes
  - You can identify a node without its closing tag by looking at `blockEndPosition`

    ```js
    node.source.slice(node.blockEndPosition.start, node.blockEndPosition.end) === ''
    ```

**Why the change**?

- `HtmlDanglingMarkerOpen` nodes did not have children, since we added support for nodes without closing markers, we removed that node type entirely.
