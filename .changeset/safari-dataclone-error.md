---
'@shopify/codemirror-language-client': patch
---

Fix `DataCloneError` on Safari by serializing the `ResponseError` before sending it to the worker.
