---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/theme-check-browser': minor
---

Theme Check Config files now accept the `context` property

In your `.theme-check.yml` files, you can set the `context` property to `theme` or `app`. By default, it's `theme`. The `theme-check:theme-app-extension` config sets it to `app`.

You shouldn't need to care about this. It's there so we can do contextual things internally.
