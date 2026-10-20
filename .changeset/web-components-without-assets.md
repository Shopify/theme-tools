---
'@shopify/theme-graph': patch
---

Build the theme graph for a theme without an `assets` folder. `getWebComponentMap` used to reject, so the language server never had a graph for that theme, even after the folder was created.
