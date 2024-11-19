---
'@shopify/theme-language-server-common': patch
'theme-check-vscode': patch
---

Add a way to disable the theme preload on boot

The `themeCheck.preloadOnBoot` (default: `true`) configuration / initializationOption can be set to `false` to prevent the preload of all theme files as soon as a theme file is opened.

We'll use this to disable preload in admin.
