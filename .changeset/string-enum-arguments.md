---
'@shopify/theme-check-common': minor
---

Validate literal arguments against LiquidDoc string enums in `render`, `content_for`, and `block` tags, including explicit render aliases. For example, `@param {'heading' | 'small'} [variant]` accepts those two string values and reports other literals. Dynamic variable values remain unverified.

Offer allowed enum members as replacements for invalid values and suggest a valid member when adding a missing required argument.
