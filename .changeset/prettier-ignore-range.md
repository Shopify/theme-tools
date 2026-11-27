---
'@shopify/prettier-plugin-liquid': minor
---

Support `prettier-ignore-start` and `prettier-ignore-end` comments to leave a range of sibling nodes unformatted. They work as HTML comments, `{% # %}` comments and `{% comment %}` tags. Without `prettier-ignore-end`, the range goes until the end of the parent node.
