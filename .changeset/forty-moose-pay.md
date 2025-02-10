---
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
---

Theme check verifies if setting key exists within block schemas and section schemas

- Check if the keys inside `presets.[].settings` and `default.settings` exist as `settings.[].id` in the same file
- Check if the keys inside `presets.[](recursive .blocks.[]).settings` and `default.blocks.[].settings` exist as `settings.[].id` inside the referenced block's file