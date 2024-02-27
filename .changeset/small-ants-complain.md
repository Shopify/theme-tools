---
'@shopify/theme-language-server-common': minor
'@shopify/theme-language-server-node': minor
'@shopify/theme-language-server-browser': minor
'theme-check-vscode': minor
---

Add section schema and translation file JSON completion and hover support

JSON object authoring and editing should be better in the following contexts:
- `sections/*.liquid` `{% schema %}` bodies
- `locales/*.json` files

Hovering over any key in any translation file will show the path of the translation key (for easy copy and paste).

Pluralized strings and `_html` support is baked into the feature.
