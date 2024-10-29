---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add on snippet rename automatic refactor support

When `snippets/*.liquid` files are renamed, we'll change all the old references to point to the new files:

- `{% render 'oldName' %}` -> `{% render 'newName' %}`
- `{% include 'oldName' %}` -> `{% include 'newName' %}`
