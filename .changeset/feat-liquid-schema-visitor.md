---
'@shopify/theme-check-common': minor
---

Add `LiquidSchema` check visitor method

Liquid checks can now declare a `LiquidSchema(node)` method in place of the repeated `LiquidRawTag` + `getSchema` + `validSchema` / `ast` preamble. The method fires once per `{% schema %}` tag in a section or theme-block file, after the schema has been JSON-parsed and validated. The payload exposes `node`, `schema`, `validSchema`, `ast`, and `offset`, with `validSchema` and `ast` guaranteed to be non-Error.

Existing `LiquidRawTag`-based checks continue to work. The two methods can be used side-by-side on the same check.
