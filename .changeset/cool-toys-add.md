---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-docs-updater': minor
'@shopify/theme-check-common': minor
'@shopify/theme-check-node': minor
'@shopify/theme-check-browser': minor
'@shopify/theme-language-server-browser': minor
'@shopify/theme-language-server-node': minor
---

Breaking: `jsonValidationSet`'s schemas public API change

Now takes a function of the following signature:

```ts
interface JsonValidationSet = {
  schemas: (context: 'theme' | 'app') => Promise<SchemaDefinition[]>
}
```

Reason being we want to support `fileMatch` overloading of `blocks/*.liquid` files and we needed a way to identify which context you're in.

Unfortunately, the JSON schema for `blocks/*.liquid` files in theme app extensions isn't the same one we have in themes. There doesn't seem to be a way to unify them either.
