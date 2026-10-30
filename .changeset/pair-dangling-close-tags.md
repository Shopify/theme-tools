---
'@shopify/liquid-html-parser': minor
---

Add a `pairDanglingCloseTags` option, off by default. Themes often open an element in each branch of a conditional and close it once after it (`{% if a %}<div class="x">{% else %}<div class="y">{% endif %}…</div>`). With the option, such a close tag becomes an `HtmlDanglingMarkerClose` when an earlier `if`, `unless` or `case` in the same scope leaves an element of that name open on every path, instead of a parse error. It pairs only with the innermost such element.
