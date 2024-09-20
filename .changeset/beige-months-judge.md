---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add HTML element name rename support

Press `F2` on an HTML element name to rename its open/close pairs in a safe manner. No setting required.

```liquid
{% # before rename %}
<div> <!-- press F2 on this `div` and have both the open and close parts be renamed at the same time -->
  <div></div>
  <div></div>
  <div></div>
</div>

{% # after rename %}
<section>
  <div></div>
  <div></div>
  <div></div>
</section>
```
