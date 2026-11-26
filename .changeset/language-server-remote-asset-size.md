---
'@shopify/theme-language-server-common': patch
'@shopify/theme-language-server-node': patch
'@shopify/theme-check-node': patch
---

The language server takes a `remoteFileSize` dependency for AssetSizeCSS and AssetSizeJavaScript. theme-language-server-node passes theme-check-node's, which is now exported, so in the editor a host name that resolves to an address that is not public gets no request either.
