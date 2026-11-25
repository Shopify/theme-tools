---
'theme-check-rs': patch
---

Match `ignore` patterns and `ignoreMissing` like `@shopify/theme-check-common`, which uses minimatch 11. Extglobs and classes don't match an empty path portion (`a/*(x)` matched `a/`) or a leading dot (`[.]*` matched `.a`), `?` and classes match a whole emoji, `[[:punct:]]` also matches symbols, `[[:print:]]` matches printable characters instead of control characters, `\|` in an extglob is a literal `|`, and a numeric range with 100 or more values matches all of its values. Matching takes polynomial time, so a pattern like `a*a*a*a*a*a*a*a*a*a*a*b` no longer takes seconds on a long file name.
