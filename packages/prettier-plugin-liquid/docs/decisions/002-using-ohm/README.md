# Using Ohm

## Status

Decided in early 2022.

## tl;dr

We decided to write a new Liquid & HTML parser with [Ohm](https://ohmjs.org/).

## Context

Consider the following:

- HTML parsers don't know about Liquid,
- Liquid parsers don't know about HTML.

If we want to do a prettier plugin for Liquid & HTML, we need to do what the Handlebars folks did: [write a parser that understands both HTML _and_ Liquid](https://prettier.io/blog/2021/05/09/2.3.0.html#move-handlebars-support-out-of-alpha-to-release-10290httpsgithubcomprettierprettierpull10290-by-dcyrillerhttpsgithubcomdcyriller--thorn0httpsgithubcomthorn0:~:text=The%20feature%20is,under%20the%20hood.).

**Problem:** Writing a parser is hard.

**Solution:** Use a parser generator.

## Why Ohm?

- It has an [online editor](https://ohmjs.org/editor/) which interactively shows the Syntax Tree that your grammar produces
- Its syntax is pretty and easy to understand
- Its `toAST` library function is powerful and powers the [Token -> Concrete Syntax Tree transformation](https://github.com/Shopify/prettier-plugin-liquid/blob/e3318d8e6ee953dc751821a9e2276c0b5124fc0b/src/parser/stage-1-cst.ts#L1157-L1161).

## Consequences

- We were able to ship an alpha version that didn't format the insides of Liquid tag, but that did format HTML + Liquid properly
- We were able to **iteratively** work on the Liquid syntax
- The Ohm dependency is [large](https://bundlephobia.com/package/ohm-js@16.6.0) (132.5kB minified, 33.5kB minified+gzip)
- Parsing is kind of slow and CPU bound
  - Dawn benchmark (12 runs, M1 mac, ~100 Liquid files):
    - max 219ms
    - min 0.17ms
    - mean 20ms
    - median 8.9ms
  - Full theme parse of ~2000ms

### Ways to undo

- Write a parser from scratch (hard) that fits the [`LiquidHTMLNode`](https://github.com/Shopify/prettier-plugin-liquid/blob/d4033f793d98b6ea164fd4a44e487d6e626d719e/src/parser/stage-2-ast.ts#L90-L110) type.

### Ways to mitigate

- Parse using [Worker threads](https://nodejs.org/api/worker_threads.html#Worker-threads) to parallelize parsing of multiple files on multiple CPU threads
