---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
'theme-check-vscode': patch
---

Add public subpath entry points for path utilities and LSP request types

`@shopify/theme-check-common/path` and `@shopify/theme-language-server-common/types` are now public entry points. They re-export the same members as the package barrel, but importing them pulls in only that module instead of the whole package.

The VS Code extension uses them to keep the language server out of the client bundle: `browser/extension.js` is 2.1 MB instead of 6.7 MB, and `node/extension.js` is 1.4 MB instead of 6.5 MB. The barrel imports still work exactly as before.
