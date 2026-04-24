---
'@shopify/liquid-html-parser': minor
---

Allow property names starting with a digit in dot lookups (e.g. `{{ address.2country.name }}`). This fixes an autocomplete regression in the language server where suggestions were silently dropped after a property whose name started with a number, because the grammar treated the dot lookup as an unparseable token. `variableSegment` (used for variable declarations and filter names) is unchanged and still rejects leading digits.
