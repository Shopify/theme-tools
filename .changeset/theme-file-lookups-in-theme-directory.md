---
'@shopify/theme-check-common': patch
'theme-check-rs': patch
---

Checks that look up a theme file by a name from theme content (`MissingAsset`, `ValidStaticBlockType`, `JSONMissingSection`, `MissingTemplate`, `JSONMissingBlock`, `ValidBlockTarget`, `AssetSizeJavaScript` and `AssetSizeCSS`) look only in the directory the path names, such as `assets`, `blocks` or `sections`. A name that leaves that directory, also in its percent-encoded form, now gets the same result whether or not a file exists at that path, and the check does not read the file system for it.
