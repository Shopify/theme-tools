---
'theme-check-rs': patch
---

Apply `ignore` patterns from `.theme-check.yml` when the theme root is inside a dot-directory, such as `.worktrees/` or `~/.cache/`, as in `@shopify/theme-check-common`.
