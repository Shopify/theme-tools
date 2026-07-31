---
'@shopify/theme-check-common': patch
---

`UndefinedObject` no longer reports `section` and `block` as undefined in theme-mode snippets.

Snippets are commonly rendered from a section or block, which pass `section` and `block` down into scope. Treating them as contextual objects in theme-mode snippets (alongside `app`) avoids false positives such as:

```
[UndefinedObject] Unknown object 'section' used.
```
