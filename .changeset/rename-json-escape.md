---
'@shopify/theme-language-server-common': patch
---

Renaming a section or block to a file name with a character that JSON escapes, such as `"`, now writes the escaped name in templates, section groups, `config/settings_data.json` and `{% schema %}` tags, so these files stay valid JSON.
