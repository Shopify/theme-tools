---
'theme-check-rs': patch
---

Report `CdnPreconnect` for every `href` on the `https://cdn.shopify.com` origin, including `href="https://cdn.shopify.com"` and `href="//cdn.shopify.com"` without a path, and stop reporting other hosts that only contain `cdn.shopify.com`, as the TypeScript check does.
