---
'@shopify/theme-check-common': minor
---

Add `NoFiltersInRenderArguments` check to error when a filter is used in `render`, `include`, and `content_for` tags.

Filters are not supported on values passed as arguments to `render`/`include`/`content_for` tags. In production, they are silently dropped, leading to unexpected outcomes when rendered.

In the example below, the `bar` argument passes through unchanged when the snippet is rendered.

```liquid
{% render 'foo', bar: 'hello' | append: ' world' %}
```

This check now reports an error pointing at the offending filter so the broken behavior is caught instead of failing silently.
