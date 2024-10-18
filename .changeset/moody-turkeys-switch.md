---
'@shopify/theme-language-server-browser': major
'@shopify/theme-language-server-common': major
'@shopify/theme-language-server-node': major
---

[Breaking] Replace fs-based dependency injection by an AbstractFileSystem injection

```diff
+ class FileSystemImpl implements AbstractFileSystem {
+   /* ... */
+ }

startServer(worker, {
- findRootURI,
- fileExists,
- fileSize,
- getDefaultTranslationsFactory,
- getDefaultLocaleFactory,
- getDefaultSchemaTranslationsFactory,
- getDefaultSchemaLocaleFactory,
- getThemeSettingsSchemaForRootURI,
+ fs: new FileSystemImpl(),
  loadConfig,
  log,
  themeDocset,
  jsonValidationSet,
})
```
