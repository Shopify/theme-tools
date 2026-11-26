---
'theme-check-rs': patch
---

AssetSizeCSS and AssetSizeJavaScript try each public address of a remote asset's host name, in order, until one accepts a connection. They no longer give size 0 when only the first address is unreachable.
