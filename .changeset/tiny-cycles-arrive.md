---
'@shopify/theme-language-server-common': major
'@shopify/theme-check-common': major
'theme-check-vscode': patch
---

Define the public entry points with a package `exports` map

- `@shopify/theme-check-common` exports `.`, `./path`, `./test`, and `./package.json`.
- `@shopify/theme-language-server-common` exports `.`, `./types`, and `./package.json`.

Importing a subpath pulls in only that module instead of the whole package. The VS Code extension
uses this to keep the language server out of the client bundle: `browser/extension.js` is 2.1 MB
instead of 6.7 MB, and `node/extension.js` is 1.4 MB instead of 6.5 MB. Barrel imports still work
exactly as before.

**Breaking:** the `exports` map is now the complete public surface of both packages. Any `src/` or
`dist/` deep import that is not listed above no longer resolves — Node and bundlers throw
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

To migrate:

- Replace `@shopify/theme-check-common/src/test` or `.../dist/test` with
  `@shopify/theme-check-common/test`.
- Seven symbols previously reachable only through a retired deep import are now exported from the
  `@shopify/theme-check-common` barrel: `getPosition`, `createDisabledChecksModule`,
  `UNMATCHED_COMMENT_CLOSE_PARSER_ERROR`, `UNMATCHED_RAW_CLOSE_PARSER_ERROR`,
  `hasRubyAcceptedInertCommentBodyCloser`, `hasJavascriptClosingTagAfter`, and
  `hasRubyAcceptedRawTagCloserWithMarkup`.

Every other symbol those modules exposed is intentionally private. If you depend on one, open an
issue so it can be promoted deliberately.
