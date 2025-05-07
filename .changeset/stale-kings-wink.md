---
'@shopify/theme-check-common': minor
---

Introduce ability the disable theme checks for the next Liquid statement

- Add `{% # theme-check-disable-next-line %}` to disable theme checks on the next Liquid statement
- To disable a specific theme-check rule, add the name(s) after `theme-check-disable-next-line`
in a comma separated format
