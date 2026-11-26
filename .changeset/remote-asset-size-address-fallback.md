---
'theme-check-rs': patch
---

AssetSizeCSS and AssetSizeJavaScript give curl every public address of a remote asset's host name, so it connects to whichever answers, as it does for a name it resolves. They no longer give size 0 when only the first address is unreachable.
