---
'@shopify/liquid-html-parser': minor
---

Read `<script>` and `<style>` bodies as raw text, as a browser does: a `<` in them is JavaScript or CSS, not an HTML tag, and the element closes at its first close tag outside Liquid. So `<script>a<script>b</script>c</script>` now ends the script at the first `</script>` and reports the second as an unmatched close tag. `<svg>` still pairs nested `<svg>` elements.

**Behavior changes**

- A `<script>` inside a script body no longer pairs with a `</script>`. `<script>document.write('<script src="a.js"></script>');</script>` and `<script type="text/template"><script>x</script></script>` now fail to parse in `strict` mode with "Attempting to close HtmlElement 'script' before it was opened".
