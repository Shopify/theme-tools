<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Theme Check
  <br>
</h1>

<h4 align="center">A linter for Shopify Themes</h4>

Theme Check helps you follow best practices by analyzing the files inside your Shopify theme.

Theme Check is available [to code editors that support the Language Server Protocol](https://github.com/Shopify/theme-check/wiki).

This repository contains the code for the following modules:

- `@shopify/theme-check-common`: npm module to run checks on a [Theme](https://github.com/Shopify/theme-check-js/blob/121715a68cc107023fceb7983f590c468095cda9/packages/common/src/types.ts#L6-L8) (runtime agnostic).
- `@shopify/theme-check-node`: npm module to run checks from a [Node.js ](https://nodejs.org) runtime.
- `@shopify/theme-check-browser`: npm module to run checks in a Browser.

## Installation

### CLI

Theme Check is integrated in the [Shopify CLI](https://github.com/Shopify/cli).

```bash
shopify theme check
```

### Language Server

Theme Check is integrated into the [Liquid Language Server](https://github.com/Shopify/liquid-language-server) for use in code editors.

```bash
shopify theme language-server
```

### As a library

There are three libraries:

```
yarn add @shopify/theme-check-node
yarn add @shopify/theme-check-common
yarn add @shopify/theme-check-browser
```

## Usage

Refer to the [Shopify CLI](https://github.com/Shopify/cli) and [Liquid Language Server](https://github.com/Shopify/liquid-language-server) for their corresponding use cases.

## Configuration

This might be a CLI concern.

## Migration

WIP. Ideally frictionless.

## Disable checks with comments

Use Liquid comments to disable and re-enable all checks for a section of your template:

```liquid
{% # theme-check-disable %}
{% assign x = 1 %}
{% # theme-check-enable %}
```

Disable a specific check by including it in the comment:

```liquid
{% # theme-check-disable UnusedAssign %}
{% assign x = 1 %}
{% # theme-check-enable UnusedAssign %}
```

Disable multiple checks by including them as a comma-separated list:

```liquid
{% # theme-check-disable UnusedAssign,SpaceInsideBraces %}
{%assign x = 1%}
{% # theme-check-enable UnusedAssign,SpaceInsideBraces %}
```

Disable checks for the _entire document_ by placing the comment on the first line:

```liquid
{% # theme-check-disable SpaceInsideBraces %}
{%assign x = 1%}
```

## Exit Code and `--fail-level`

That's a CLI concern.

## Language Server Configurations

Those are a LLS concern.

## Contributing

For guidance on contributing, refer to this [doc](/CONTRIBUTING)
