---
'theme-check-rs': patch
---

Fix `theme-check-disable-next-line` not suppressing offenses when the following tag is nested inside a raw HTML tag (`<style>`, `<script>`, `<svg>`)
