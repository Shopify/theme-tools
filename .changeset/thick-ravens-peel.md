---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add tupled highlighting of HTML element names and Liquid blocks

When you hover over a HTML tag open, the close tag is highlighted and vice-versa.

```html
<div> <!-- this div gets highlighted -->
   <div></div>
</div> <!-- with this one-->
```

When you hover over a Liquid block open, the close block is highlighted (and branches if any).

```liquid
{% # this if, elsif, else, endif all get highlighted together %}
{% if cond %}

{% elsif cond %}

{% else %}

{% endif %}
```
