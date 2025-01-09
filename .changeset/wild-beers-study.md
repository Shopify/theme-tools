---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add "On theme block rename" handling

Whenever a theme block gets renamed, the following will now happen:
  1. References in files with a `{% schema %}` will be updated automatically
  2. References in template files will be updated automatically
  3. References in section groups will be updated automatically
  4. References in `{% content_for "block", type: "oldName" %}` will be updated automatically
