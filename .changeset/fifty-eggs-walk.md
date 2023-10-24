---
'@shopify/liquid-html-parser': minor
---

Add `nodes` property to RawMarkupKind to allow for subtree visiting

- Partially breaking in the sense where Liquid (not LiquidHTML) syntax errors will be reported from within scripts, styles, and JSON blobs
