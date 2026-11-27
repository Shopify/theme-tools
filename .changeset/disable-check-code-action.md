---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add "Disable <Check> for this line" and "Disable <Check> for this file" quick fixes for Theme Check offenses in Liquid files. They insert a `theme-check-disable-next-line` comment before the node that holds the offense, or a `theme-check-disable` comment at the top of the file. Inside `{% liquid %}` tags the comment is a `#` line.
