<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-tools/blob/main/packages/vscode-extension/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Theme Graph
</h1>

<h4 align="center">A data structure that represents your Shopify theme</h4>

A Shopify Theme Graph is a data structure that spans Liquid, JSON, JavaScript and CSS files.

It has the following interface:

```ts
interface ThemeGraph {
  rootUri: UriString; // e.g. 'file:/path/to/horizon'
  entryPoints: ThemeModule[];
  modules: Record<UriString, ThemeModule>
}
```

A `ThemeModule` holds _dependencies_ and _references_ of a module. For instance,

```ts
interface LiquidModule {
  uri: UriString;
  type: 'liquid';
  kind: 'block' | 'layout' | 'section' | 'snippet' | 'template';
  references: Reference[];
  dependencies: Reference[];
}
```

For a module $M$,
- a _reference_ is a backlink to _other_ modules that depend on $M$,
- a _dependency_ is a dependent link on another module.

```ts
interface Reference {
  /* The file that initiated the dependency/reference */
  source: { uri: string, range?: Range };

  /* The file that it points to */
  target: { uri: string, range?: Range };

  type:
    | 'direct'   // e.g. {% render 'child' %}, {{ 'theme.js' | asset_url }}, <custom-element>, etc.
    | 'indirect' // e.g. Sections and blocks that accept theme blocks
    | 'preset'   // e.g. Section and block presets
}
```

See [types.md](./src/types.ts) for more details.

## Installation

```bash
npm install @shopify/theme-graph
```

## Usage

### Through the VS Code extension

The theme graph is used by the VS Code extension to power the dependencies, references and dead code features.

### From the CLI

```
Usage:
  theme-graph <path-to-theme-directory>

Example:
  theme-graph horizon > graph.json
```

### As a library

[See bin/theme-graph](./bin/theme-graph) for inspiration.

## Contributing

See [CONTRIBUTING.md](../../docs/contributing.md).
