---
'@shopify/theme-language-server-common': patch
---

Add required parameters when autocompleting filters

When autocompleting a Liquid filter that has required parameters we'll
automatically add them with tab support. For example, if you using the
completion feature to add the `image_url` filter we'll automatically add the
`width` and `height` parameters for it.
