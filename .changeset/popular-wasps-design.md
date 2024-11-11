---
'@shopify/theme-language-server-common': patch
---

Gate the `{Asset,Snippet}RenameHandler` behind the `workspace.applyEdit` client capability
