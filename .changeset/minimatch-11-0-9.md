---
'@shopify/theme-check-common': patch
---

Update minimatch to 11.0.9. In `ignore` and `ignoreMissing` patterns with braces, an escaped backslash (`\\`) stays a literal backslash, and a numeric range without a step, such as `{1..200000}`, matches all of its values.
