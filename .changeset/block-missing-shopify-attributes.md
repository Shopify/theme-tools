---
'@shopify/theme-check-common': minor
---

Add `BlockMissingShopifyAttributes` check. Warns when a `blocks/*.liquid` file declares `"tag": null` in its `{% schema %}` but its rendered markup does not include `{{ block.shopify_attributes }}`. Without that, the theme editor cannot recognise the block in the preview, and merchants reordering blocks leaves orphaned markup behind. See [Shopify's `tag` field documentation](https://shopify.dev/docs/storefronts/themes/architecture/blocks/theme-blocks/schema#tag).

Phase 1: only the current file is checked. Cases where the markup is delegated to a rendered snippet, or where `block.shopify_attributes` is rendered multiple times, are out of scope.
