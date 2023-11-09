---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add better auto-closing UX for Liquid pairs

- Type `{{` get `{{ | }}` (cursor at `|`)
- Type `{{-` get `{{- | -}}`
- Type `{%` get `{% | %}`
- Type `{%-` get `{%- | -%}`
- Add a `-` on one side, only that side is affected
- See [PR](https://github.com/Shopify/theme-tools/pull/242) for video
- Only for `shopifyLiquid.themeCheckNextDevPreview`
