---
'@shopify/theme-language-server-common': minor
'@shopify/theme-language-server-node': minor
---

Support completion + hover for presets blocks settings under `{% schema %}` tag

- Hover + Completion description for `presets.[].blocks.[].settings` will be from the referenced
block's setting's label - i.e. `settings.[].label`
  - The label will be translated if it contains a translation key
