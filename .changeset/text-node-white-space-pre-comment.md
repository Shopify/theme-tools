---
'@shopify/prettier-plugin-liquid': patch
---

Fix `{% # white-space: pre %}` comment hint being ignored for plain text nodes, which caused files with meaningful line breaks but no HTML tags (e.g. a `robots.txt.liquid` template) to have their lines incorrectly joined together
