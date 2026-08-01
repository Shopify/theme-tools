---
'@shopify/theme-check-common': patch
---

`UndefinedObject` no longer reports `section` and `block` objects as undefined in theme snippet files.

When snippets are rendered in a section or block, the `section` and `block` context is already available without needing to be passed as a parameter. Treating these objects as defined contextual objects in theme snippets avoids false positives from the check.
