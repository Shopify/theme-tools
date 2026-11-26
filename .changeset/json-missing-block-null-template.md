---
'@shopify/theme-check-common': patch
---

Stop `JSONMissingBlock` from throwing on a JSON template that isn't an object, such as a `templates/index.json` that contains `null`
