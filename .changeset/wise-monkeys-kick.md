---
'@shopify/prettier-plugin-liquid': minor
---

Add support for unclosed HTML nodes inside branching code

The following code is now supported by the formatter:

```liquid
{% if cond %}
  <details>
    <summary>...</summary>
{% endif %}
```

To follow: a linting rule that warns you if the pairs are unbalanced.
