---
'@shopify/theme-check-common': patch
---

Run all checks on a Liquid file in one walk of its AST, instead of one walk per check.

Each check still runs its methods in the order it did before, each one settled before the next, and a check that throws still stops on that file only. On Dawn and Horizon, `check()` returns the same offenses 2–3× faster. Offenses from different checks may come back in a different order.
