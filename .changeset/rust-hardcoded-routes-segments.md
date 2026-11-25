---
'theme-check-rs': patch
---

Only report `HardcodedRoutes` when the route matches whole path segments, so `/cartography` is no longer flagged as `/cart`. A route followed by a format extension, such as `/cart.js` or `/cart/add.js`, is still reported.
