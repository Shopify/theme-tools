---
'@shopify/prettier-plugin-liquid': patch
---

Fix standalone build importing `prettier` instead of `prettier/standalone`, which caused browser bundlers (webpack, rollup, vite) consuming `standalone.js` to try to resolve Node builtins (`module`, `url`, `path`) from prettier's main entry
