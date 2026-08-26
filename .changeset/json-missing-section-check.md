---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Add `JSONMissingSection` check

Reports section types in JSON templates (`templates/*.json`) and section groups (`sections/*.json`) that do not refer to an existing section file, matching the platform validation that rejects theme publishes with the error `Section type 'x' does not refer to an existing section file`.
