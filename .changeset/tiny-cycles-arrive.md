---
'@shopify/theme-language-server-common': major
'@shopify/theme-check-common': major
'theme-check-vscode': patch
---

Define the public entry points with a package `exports` map

`@shopify/theme-check-common` now exports `.`, `./path`, `./test`, and `./package.json`.
`@shopify/theme-language-server-common` now exports `.`, `./types`, and `./package.json`.

Importing a subpath pulls in only that module instead of the whole package. The VS Code extension
uses them to keep the language server out of the client bundle: `browser/extension.js` is 2.1 MB
instead of 6.7 MB, and `node/extension.js` is 1.4 MB instead of 6.5 MB. The barrel imports still
work exactly as before.

**Breaking:** the `exports` map is now the complete public surface of both packages. Any `src/` or
`dist/` deep import that is not listed above is unsupported and no longer resolves — Node and
bundlers throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. This encapsulation is the point of the major, not a
side effect. Note that under `moduleResolution: "node"` TypeScript does not model `exports`, so a
retired deep import can still type-check while failing at runtime; grep for
`theme-check-common/dist`, `theme-check-common/src`, `theme-language-server-common/dist` and
`theme-language-server-common/src` instead of relying on `tsc`.

The test helpers keep a supported path:

| Removed                                                                         | Use instead                        |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| `@shopify/theme-check-common/src/test`, `@shopify/theme-check-common/dist/test` | `@shopify/theme-check-common/test` |

Seven symbols that were previously reachable only through a retired deep import are now exported
from the `@shopify/theme-check-common` barrel:

| Symbol                                  | Previously imported from                         |
| --------------------------------------- | ------------------------------------------------ |
| `getPosition`                           | `.../dist/utils`                                 |
| `createDisabledChecksModule`            | `.../dist/disabled-checks`                       |
| `UNMATCHED_COMMENT_CLOSE_PARSER_ERROR`  | `.../dist/checks/liquid-syntax-error/comment`    |
| `UNMATCHED_RAW_CLOSE_PARSER_ERROR`      | `.../dist/checks/liquid-syntax-error/comment`    |
| `hasRubyAcceptedInertCommentBodyCloser` | `.../dist/checks/liquid-syntax-error/comment`    |
| `hasJavascriptClosingTagAfter`          | `.../dist/checks/liquid-syntax-error/javascript` |
| `hasRubyAcceptedRawTagCloserWithMarkup` | `.../dist/checks/liquid-syntax-error/utils`      |

That is not a complete replacement table for the retired modules. Every other symbol they exposed is
intentionally private and has no barrel equivalent. In particular `getOffset` is **not** promoted:
two different implementations exist (`utils/position` and `checks/liquid-syntax-error/utils`) and
they disagree on out-of-range input, so no automatic replacement is offered. If you depend on a
symbol that is now private, open an issue so it can be promoted deliberately.
