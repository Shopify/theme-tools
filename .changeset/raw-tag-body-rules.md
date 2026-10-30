---
'@shopify/liquid-html-parser': patch
---

End each raw tag's body by the rule of the Liquid class that parses it, in templates and in `{% liquid %}`:

- `{% comment %}` nests, skips the bodies of raw tags inside it, and closes on any tag named `endcomment`, so `{% endcomment xyz %}` closes it.
- `{% raw %}`, `{% javascript %}`, `{% schema %}` and `{% stylesheet %}` close at their first end tag, extra markup included, so `{% endraw xyz %}` closes `{% raw %}`.
- `{% doc %}` reads like `{% raw %}` but rejects a nested `{% doc %}`.
- `{% style %}` is a block, so it nests.

Templates that Liquid reports as never closed now fail to parse too, such as a comment whose body Liquid's tokenizer runs past the `{% endcomment %}`.
