---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add on asset rename automatic refactor support

When `assets/*` files are renamed, we'll change all the old references to point to the new files:

- `{{ 'oldName.js' | asset_url }}` -> `{{ 'newName.js' | asset_url }}`
- `{% echo 'oldName.js' | asset_url %}` -> `{% echo 'newName.js' | asset_url %}`

Works with `.(js|css).liquid` asset files as well.
