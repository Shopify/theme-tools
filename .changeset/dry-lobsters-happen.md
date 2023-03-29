---
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Simplify public API

Breaking changes:

- `Theme` is `SourceCode<S>[]` instead of `{ files: Map<string, SourceCode<S>> }`
- `SourceCode` no longer has a `relativePath` property
- `toSourceCode` no longer takes a `relativePath` as argument
- `Config` has a `root` property
