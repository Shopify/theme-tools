---
'@shopify/theme-language-server-node': patch
'@shopify/theme-check-node': patch
---

Improve root finding of theme app extensions and zipped themes

Folders for which all the following is true are considered a root:
- have a `snippets/` folder, and
- don't have a `../.theme-check.yml`,
- don't have a `../../.theme-check.yml`.

No config file or `.git` folder required.
