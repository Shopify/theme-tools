---
'@shopify/theme-check-browser': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Rename and alias a couple of checks

- `DeprecatedFilters` -> `DeprecatedFilter`
- `DeprecatedTags` -> `DeprecatedTag`
- Alias `LiquidHTMLSyntaxError` with `SyntaxError` and `HtmlParsingError`
- Alias `ParserBlockingJavaScript` with `ParserBlockingScriptTag`
- Alias `JSONSyntaxError` with `ValidJson`
- Alias `AssetSizeCSS` with `AssetSizeCSSStylesheetTag`
- Alias `RemoteAsset` with `AssetUrlFilters`
