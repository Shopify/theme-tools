<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Liquid HTML parser
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@shopify/liquid-html-parser"><img src="https://img.shields.io/npm/v/@shopify/liquid-html-parser.svg?sanitize=true" alt="Version"></a>
  <a href="https://github.com/Shopify/theme-tools/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@shopify/liquid-html-parser.svg?sanitize=true" alt="License"></a>
  <a href="https://github.com/Shopify/liquid-html-parser-prototype/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Shopify/prettier-plugin-liquid-prototype/actions/workflows/ci.yml/badge.svg"></a>
  <!--
    <a href="https://npmcharts.com/compare/@shopify/liquid-html-parser?minimal=true"><img src="https://img.shields.io/npm/dm/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Downloads"></a>
  -->
</p>

This module provides the Liquid HTML parser that powers the prettier plugin, linter and language server for Liquid-powered Shopify themes.

It turns a `.liquid` file contents into an Abstract Syntax Tree (AST) that contains _both_ Liquid and HTML nodes.

## Installation

```bash
# with npm
npm install @shopify/liquid-html-parser

# with yarn
yarn add @shopify/liquid-html-parser
```

## Usage

```ts
import { toLiquidHtmlAST, LiquidHtmlNode, NodeTypes } from '@shopify/prettier-plugin-liquid';

const ast: LiquidHtmlNode = toLiquidHtmlAST(`
<body>
  {% for product in all_products %}
    <img src="{{ product | image_url }}">
  {% endfor %}
</body>
`);
```

## You should know

Because Liquid is very permissive, things like the `name` of an HTML tag may have a surprising type: an array of `LiquidVariableOutput | TextNode`. 

This is because the following use cases are supported by the parser:

```liquid
{% # compound html tag names %}
<tag-{{ name }}>
</tag-{{ name }}>

{% # compound html attribute names %}
<img data-{{ attr_name }}="...">
```

## Rust backend (experimental)

The `rust/` directory holds a Rust port of this parser, built to WebAssembly. It is not published and nothing uses it by default. The TypeScript parser stays the default, and a TS-only build needs no Rust toolchain.

### Setup

At Shopify, run this from the repo root:

```bash
/opt/dev/bin/dev up
```

Without `dev`, install [rustup](https://rustup.rs) 1.28 or later, then run these from the repo root. `rustup toolchain install` reads `rust-toolchain.toml` there, which pins the Rust version and adds the `wasm32-unknown-unknown` target.

```bash
pnpm install
rustup toolchain install
cargo install wasm-bindgen-cli --version 0.2.129 --locked
```

The `wasm-bindgen-cli` version must equal the `wasm-bindgen` version in `rust/Cargo.lock`. `build:rust` checks this and prints the install command when they differ.

### Build

```bash
pnpm --dir packages/liquid-html-parser build:rust
```

This writes `rust/pkg/`, which is gitignored.

### Run the tests against the Rust backend

`LIQUID_PARSER=rust` registers the Rust backend before any test runs. `LIQUID_PARSER=ts`, or leaving it unset, uses the TS parser. Any other value fails the run.

```bash
CI=1 LIQUID_PARSER=rust pnpm exec vitest run
LIQUID_PARSER=rust pnpm --dir packages/prettier-plugin-liquid test
LIQUID_PARSER=rust pnpm --dir packages/prettier-plugin-liquid test:3
LIQUID_PARSER=rust pnpm --dir packages/prettier-plugin-liquid test:idempotence
LIQUID_PARSER=rust pnpm --dir packages/prettier-plugin-liquid test:idempotence:3
```

Outside tests, `node --import <path to this package>/rust/register.mjs` registers it the same way.

## License

MIT.
