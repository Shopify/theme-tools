---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-docs-updater': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/theme-check-browser': minor
'@shopify/theme-language-server-browser': minor
---

Add support for the schemas manifest on Shopify/theme-liquid-docs

Shopify/theme-liquid-docs now supports composable JSON schemas (with relative paths). To solve the `blocks/*.liquid` file match JSON schema overload depending on the context (`app` or `theme`), we defined two manifests that describe the schemas required by your solution and define the fileMatch rules:

- [manifest_theme.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)
- [manifest_theme_app_extension.json](https://github.com/Shopify/theme-liquid-docs/blob/main/schemas/manifest_theme.json)

`@shopify/theme-check-docs-updater` now reads those manifests and downloads the tree of dependency that they require. We will no longer need to make new theme-tools releases whenever we add new schemas. We'll be able to dev them and their file associations directly from Shopify/theme-liquid-docs and have downstream consumers updated automatically (the same way docs are automatically updated).
