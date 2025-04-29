---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
---

Support LiquidDoc param array types

- LiquidDoc param types supports 1D arrays as param types
- Square brackets are placed after the param type to denote arrays

E.g.
```
{% doc %}
  @param {product[]} my_products - an array of products
  @param {string[]} my_strings - an array of strings
{% enddoc %}
```
