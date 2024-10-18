---
'@shopify/theme-check-browser': major
'@shopify/theme-check-common': major
'@shopify/theme-check-node': major
---

[Breaking] Replace fs-based dependency injections with AbstractFileSystem injection

```diff
runChecks(theme, {
- getDefaultTranslations,
- getDefaultLocale,
- getDefaultSchemaLocale,
- getDefaultSchemaTranslations,
- fileExists,
- fileSize,
+ fs: new FileSystemImpl(),
  themeDocset,
  jsonValidationSet,
})
```
