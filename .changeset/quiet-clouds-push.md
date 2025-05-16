---
'@shopify/theme-language-server-common': patch
---

Add completion + hover support for presets/default section block settings

- Preset + Default block settings will pick up Section block for completion + hover support
  - If the setting label is a translation, it will be translated during hover

E.g.

```
{
  "name": "Example Section",
  "blocks": [
    {
      "type": "local_block",
      "name": "My local block",
      "settings": [
        {
          "type": "text",
          "id": "local_block_text",
          "label": "Local Block Text",
          "default": "This is a block"
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "Preset Example Section",
      "category": "Custom",
      "blocks": [
        {
          "type": "local_block",
          "name": "Preset Block Text",
          "settings": {
            // Code completion will show `local_block_text` with "Local Block Text" during hover
            "█": ""
          }
        }
      ]
    }
  ]
}
```
