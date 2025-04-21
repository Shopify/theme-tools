---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Restrict LiquidDoc param names in blocks based on `content_for` tag params

- LiquidDoc inside blocks have limitations on names because `content_for` tag uses the following param names:
  - id
  - type
  - attributes
  - block
  - blocks
  - class
  - context
  - inherit
  - resource
  - resources
  - schema
  - section
  - sections
  - settings
  - snippet
  - snippets
  - template
  - templates
