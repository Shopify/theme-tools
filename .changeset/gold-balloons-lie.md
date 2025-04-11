---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
---

[Feature] Support more types for LiquidDoc param

- Support [liquid objects](https://shopify.dev/docs/api/liquid/objects) as LiquidDoc param type
  - Object is NOT supported if it is exclusively a global liquid variable
  - Object is NOT supported if it is deprecated