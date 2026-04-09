---
'@shopify/theme-check-node': patch
---

Fix VSCode extension failing to resolve custom check packages from node_modules (e.g. `extends: '@acme/theme-check-extension/recommended.yml'`). The extension server is webpack-bundled, so `require.resolve` was being handled by webpack instead of Node.js, returning a module ID rather than a file path. Now uses `createRequire` from `node:module` to get real Node.js resolution.
