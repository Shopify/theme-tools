# @shopify/liquid-html-parser

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
