---
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add dependencies to public API

- `fileExists(absolutePath: string): Promise<boolean>` returns true when a file exists
- `getDefaultTranslations(): Promise<JSONObject>` returns the parsed JSON contents of the default translations file

These dependencies are now added to the `context` object and are usable by checks.

Those exists as a lean way to get rid of the assumptions that all files are in the `Theme` object. We should be able to go a long way with these.
