---
'@shopify/theme-language-server-browser': minor
'@shopify/theme-language-server-common': minor
'@shopify/theme-language-server-node': minor
'@shopify/theme-check-docs-updater': minor
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/codemirror-language-client': patch
'release-orchestrator': patch
---

Breaking: internal rename of `schemaValidators` to `jsonValidationSet`

This breaks the browser dependencies public API (for `startServer` and `runChecks`) and will thus require some code changes in those contexts.

The node packages absorb the dependency injection and are not breaking.
