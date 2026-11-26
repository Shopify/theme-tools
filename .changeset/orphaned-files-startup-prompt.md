---
'theme-check-vscode': minor
'@shopify/theme-language-server-common': patch
---

Surface orphaned (dead) files on startup with a notification

Turn on the new `themeCheck.checkOrphanedFilesOnBoot` setting (default `false`) to have the VS Code extension check each theme for orphaned files on startup, instead of running the dead-code command manually. Each theme with orphaned files gets a dismissable notification that names the theme, with **Review** (opens the dead-code picker) and **Don't show again** actions. The check is off when `themeCheck.preloadOnBoot` is false.

Dead code now lists only theme files the theme graph can link to. It no longer reports tooling files such as `assets/package.json` and `assets/jsconfig.json`, or Liquid assets the graph doesn't follow, such as `assets/icon.svg.liquid`.
