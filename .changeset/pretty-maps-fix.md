---
'@shopify/liquid-html-parser': patch
---

Add support for incomplete filter statements

Adds the ability to continue to parse liquid code that would otherwise be
considered invalid:

```liquid
{{ product | image_url: width: 100, c█ }}
```

The above liquid statement will now successfully parse in all placeholder modes
so that we can offer completion options for filter parameters.
