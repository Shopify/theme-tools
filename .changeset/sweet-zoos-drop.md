---
'theme-check-vscode': minor
---

Improve support of unclosed HTML nodes inside conditional code

The following code is now supported by the Liquid prettier plugin and the `"shopifyLiquid.themeCheckNextDevPreview"` VS Code setting.

```liquid
<div>
  {% if is_accordion %}
    <details>
      <summary>
  {% else %}
    <h3>
  {% endif %}

  ... summary/header content ...

  {% if is_accordion %}
    </summary>
  {% else %}
    <a href="{{ bookmark }}"><svg>...</svg></a>
    </h3>
  {% endif %}

  ... body content ...

  {% if accordion %}
    </details>
  {% endif %}
</div>
```

Code that doesn’t properly close across branches will be flagged by a new theme check: `UnclosedHTMLElement`. See [PR](https://github.com/Shopify/theme-tools/pull/254) for details.
