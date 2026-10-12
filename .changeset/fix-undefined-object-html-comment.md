---
'@shopify/theme-check-common': patch
---

Fix `UndefinedObject` false positive when an `assign`, `capture`, `increment`, or `decrement` is nested inside an HTML comment. Liquid is executed at runtime regardless of being inside `<!-- ... -->`, but the parser stores the comment body as opaque text, so the visitor never reached the inner tags. The check now re-parses comment bodies and pre-registers any file-scoped variable declarations they contain, scoped from the end of the comment onward.
