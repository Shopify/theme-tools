---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'theme-check-rs': minor
---

Add the `ValidImageTagWidths` check, which warns when the `widths` of an `image_tag` filter go beyond the `width` of the `image_url` filter before it, such as `{{ image | image_url: width: 1500 | image_tag: widths: '750, 1500, 3000' }}`. `image_tag` can't serve images wider than the `image_url` width, so the larger srcset widths never get larger images.
