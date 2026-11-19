---
'@shopify/theme-check-common': patch
---

Only report `HardcodedRoutes` when the route matches whole path segments, so `/cartography` is no longer flagged as `/cart`.
