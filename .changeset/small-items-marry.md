---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Introduce new theme-check to detect invalid CSS class usage in HTML

`ValidScopedCSSClass` detects invalid CSS classes in HTML if it deems them being out of scope.
A CSS class is in-scope if it matches any of the following:
- The CSS class is declared in `assets/*.css` file
- The CSS class is declared in the file's `stylesheet` tag
- The CSS class is declared in a *direct* ancestor's `stylesheet` tag
- The CSS class is declared in a snippet file's `stylesheet` tag that is rendered by this file or its direct ancestor (recursive)