---
'@shopify/theme-graph': patch
---

Build the theme graph when `templates/` has a file that isn't a `.json` or `.liquid` template, such as `.DS_Store` or `customers/.keep`. The graph skips it instead of failing, which made `OrphanedSnippet` report every snippet
