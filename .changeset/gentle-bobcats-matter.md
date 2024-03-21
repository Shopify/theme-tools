---
'@shopify/theme-language-server-common': patch
'@shopify/theme-language-server-node': patch
'theme-check-vscode': patch
---

Theme translation completion now appends parameters

For example, if your translation look like this:

```json
{
  "items": {
    "one": "{{ count }} item",
    "other": "{{ count }} items"
  }
}
```

Then we’ll complete like this:

```liquid
{{ 'items' | t: count: count }}
```
