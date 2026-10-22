---
'@shopify/theme-check-common': patch
---

Stop `UndefinedObject` from reporting `continue` in `{% for ... offset: continue %}`. It is a Liquid keyword there, not a variable.
