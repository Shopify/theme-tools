---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-common': minor
---

Support metafield auto-completion based on .shopify/metafields.json file

- The metafield definitions can be fetched from Admin API
- The format of the JSON needs to be the following:

```
{
    "<definition_group>": [
        {
            "name": "...",
            "namespace": "...",
            "description": "...",
            "type": {
                "category": "...",
                "name": "..."
            },
        },
        ...
    ],
    ...
}
```

The definition group needs to be one of the following:
- 'article'
- 'blog'
- 'brand'
- 'collection'
- 'company'
- 'company_location'
- 'location'
- 'market'
- 'order'
- 'page'
- 'product'
- 'variant'
- 'shop'
