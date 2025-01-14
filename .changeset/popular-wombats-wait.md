---
'@shopify/theme-language-server-common': minor
---

Support `content_for` block type completion + document link

- The following code will offer completion suggestions based on public blocks
  within the blocks folder.
```
{% content_for "block", type: "█", id: "" %}
```
- You can navigate to a block file by clicking through the `type` parameter value
  within the `content_for "block"` tag.