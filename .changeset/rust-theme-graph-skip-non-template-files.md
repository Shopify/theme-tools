---
'theme-check-rs': patch
---

Build the theme graph when `templates/` has a file that isn't a `.json` or `.liquid` template, such as `.DS_Store` or `customers/.keep`, so `OrphanedSnippet` no longer reports every snippet
