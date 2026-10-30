---
'@shopify/liquid-html-parser': patch
---

Read `<script>` and `<style>` bodies as raw text, as a browser does: a `<` in them is JavaScript or CSS, not an HTML tag, and the element closes at its first close tag outside Liquid. So `<script>a<script>b</script>c</script>` now ends the script at the first `</script>` and reports the second as an unmatched close tag. `<svg>` still pairs nested `<svg>` elements.
