---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add "On section rename" handling

When `sections/*.liquid` files are renamed, we will update all references to these files in their previous locations. This includes:

- `templates/*.json` files that referenced the old file name
- `sections/*.json` files that referenced the old file name
- Static section calls formatted as `{% section 'old-name' %}`
