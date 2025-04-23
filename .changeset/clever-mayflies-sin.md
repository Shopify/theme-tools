---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add `content_for` argument theme checks if static block has LiquidDoc

- DuplicateContentForArguments - Ensures arguments provided for `content_for` tag are unique
- MissingContentForArguments - Ensures all required arguments, as per LiquidDoc, are provided
- UnrecognizedContentForArguments - Ensures arguments provided exclusively match LiquidDoc params
- ValidContentForArgumentTypes - Ensures arguments match type defined in LiquidDoc
