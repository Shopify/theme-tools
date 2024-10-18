---
'@shopify/theme-check-common': major
'@shopify/theme-language-server-common': major
---

[Breaking] Replace absolute path concerns with URIs

This implies a couple of changes:
- `Config` now holds a `rootUri` instead of `root` path.
- `loadConfig` injections needs to change their return value accordingly
- In checks,
   - The context helper `absolutePath` has been replaced by `toUri`
   - The context helper `relativePath` has been replaced by `toRelativePath`
- `SourceCode` objects now hold a `uri` instead of a `path`
- `toSourceCode` now accepts a `uri` instead of a `path`
