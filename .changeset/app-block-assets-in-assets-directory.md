---
'@shopify/theme-check-common': patch
---

`AssetSizeAppBlockJavaScript` and `AssetSizeAppBlockCSS` look up only files directly in the `assets` directory. A `javascript` or `stylesheet` value that leaves that directory, including in its percent-encoded form, now gets the same offense whether or not the file exists, and the check does not read its size.
