---
'@shopify/theme-language-server-common': minor
'@shopify/theme-check-docs-updater': minor
'@shopify/theme-check-common': minor
---

Breaking: Redesign `jsonValidationSet` public API

(Only breaking for in-browser packages, node packages are still batteries-included)

Before:

```ts
type JsonValidationSet = {
  sectionSchema(): Promise<string>;
  translationSchema(): Promise<string>;
  validateSectionSchema(): Promise<ValidateFunction>;
}
```

After:

```ts
type URI = string;

type SchemaDefinition = {
  uri: string;
  fileMatch?: string[];
  schema: Promise<string>;
}

type JsonValidationSet = {
  schemas: SchemaDefinition[]
}
```

We’re getting rid of [ajv](https://ajv.js.org/) and we’ll use [vscode-json-languageservice](https://github.com/microsoft/vscode-json-languageservice) in Theme Check instead. That dependency is required by the language server anyway, might as well reuse it instead of depending on a totally different solution for validation. We'll also get better reporting of Syntax Errors because the parser used by `vscode-json-languageservice` is better.

Moreover, this new design leaves space for `$ref` support.
