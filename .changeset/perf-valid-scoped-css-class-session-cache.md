---
'@shopify/theme-check-common': patch
'@shopify/theme-language-server-common': patch
---

Restore `ValidScopedCSSClass` to the recommended config after fixing its save-latency regression on large themes. The check's per-file CSS class extraction now lives on the language server's document model, so it is memoized per file version and invalidated automatically when a file changes — no more full-theme rescan on every save. Also skips syntax-tree parsing for Liquid files that have no stylesheet tag. Resolves [#1179](https://github.com/Shopify/theme-tools/issues/1179) and reverses the temporary opt-out from [#1180](https://github.com/Shopify/theme-tools/pull/1180).
