---
'@shopify/theme-check-common': minor
---

Introduce API for schema definition

**New**: The `meta.schema` property of `CheckDefinition`s accept a key-value pair of `SchemaProp`.

```typescript
const schema = {
  myNumberSetting: SchemaProp.number(10),
  myStringSetting: SchemaProp.string('default'),
  myStringArraySetting: SchemaProp.array<string>(['default', 'value']),
  myBooleanSetting: SchemaProp.boolean(true),
  myObjectSetting: SchemaProp.object({
    age: SchemaProp.number(),
    name: SchemaProp.string(),
    company: SchemaProp.object({
      name: SchemaProp.string(),
    }).optional(),
  }),
}

// `<typeof schema>` is required to type `context.settings`.
export const SomeCheck: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: '...',
    name: '...',
    docs: { /* ... */ },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema,
    targets: [],
  },
  create(context) {
    context.settings.severity;                      // typed as Severity
    context.settings.myNumberSetting;               // typed as number
    context.settings.myBooleanSetting;              // typed as boolean
    context.settings.myStringSetting;               // typed as string
    context.settings.myStringArraySetting;          // typed as string[]
    context.settings.myObjectSetting.age;           // typed as number | undefined
    context.settings.myObjectSetting.name;          // typed as string
    context.settings.myObjectSetting.company?.name; // typed as string | undefined
    return {};
  },
}
```
