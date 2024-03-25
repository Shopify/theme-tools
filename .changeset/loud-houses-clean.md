---
'@shopify/theme-language-server-common': minor
'@shopify/theme-language-server-node': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/codemirror-language-client': patch
---

Breaking: add `getDefaultSchema{Locale,Translations}(Factory)?` dependencies

To be used to power `MatchingTranslations` for [Schema translations](https://shopify.dev/docs/themes/architecture/locales/schema-locale-files).

To be used to power Schema translations code completion and hover in section and theme block `{% schema %}` JSON blobs.
