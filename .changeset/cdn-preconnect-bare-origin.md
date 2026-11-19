---
'@shopify/theme-check-common': patch
---

Report `CdnPreconnect` for `href="https://cdn.shopify.com"` and `href="//cdn.shopify.com"` without a trailing path, and stop reporting hosts that only contain `cdn.shopify.com` in their path.
