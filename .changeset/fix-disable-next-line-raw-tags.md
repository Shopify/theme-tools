---
'@shopify/theme-check-common': patch
---

Fix `theme-check-disable-next-line` not suppressing offenses when the following tag is nested inside a raw HTML tag (`<style>`, `<script>`, `<svg>`). Previously, the sibling-node lookup only checked for a `children` array, but nodes inside raw HTML tags are stored under a `nodes` property on the `RawMarkup` body, so the disable comment was silently ineffective in that context.
