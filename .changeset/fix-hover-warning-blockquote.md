---
'@shopify/theme-language-server-common': patch
---

Fix tag/filter doc warnings collapsing onto the previous line on hover. Blockquote admonitions (e.g. the `image_url` filter's Caution/Note) are now preserved on their own lines instead of being flattened into the surrounding text.
