---
'@shopify/prettier-plugin-liquid': minor
---

Add `captureWhitespaceSensitivity` configuration option.

- When `strict` (default), behaves as before: treats the child nodes of `{% capture var %}` child nodes as strictly whitespace sensitive, therefore does not reformat contents.
- When `ignore` (new), makes it behave like tags that are not whitespace sensitive. Warning: blindly running this will alter the string value of variables captured by the capture tag.

```liquid
{% # with captureWhitespaceSensitivity: ignore %}

{% # input %}
{% capture var %}
{% for x in y %}
{{ x }}
{% endfor %}
{% endcapture %}

{% # output %}
{% capture var %}
  {% for x in y %}
    {{ x }}
  {% endfor %}
{% endcapture %}
```
