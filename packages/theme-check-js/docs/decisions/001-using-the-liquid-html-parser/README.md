# Using the Liquid HTML AST

## Status

Proposal

## tl;dr

Let's use the [LiquidHTML AST](https://github.com/Shopify/prettier-plugin-liquid/blob/v1.0.6/src/parser/stage-2-ast.ts#L90-L110) we made for the prettier plugin in this project.

## Context

Theme Check Ruby currently suffers from having three parsers: a Liquid parser, an HTML parser and a JSON parser.

This is problematic because neither Liquid knows about HTML or HTML knows about Liquid. This comes with problems:

- We have duplicated "ideological" checks for things that span HTML and Liquid (e.g. [ParserBlockingJavaScript](https://github.com/Shopify/theme-check/blob/bf8f05fb4cd214bea2a0e40a04827c63815edfc5/docs/checks/parser_blocking_javascript.md) and [ParserBlockingScriptTag](https://github.com/Shopify/theme-check/blob/bf8f05fb4cd214bea2a0e40a04827c63815edfc5/docs/checks/parser_blocking_script_tag.md))
- We have to do complicated [hacks](https://github.com/Shopify/theme-check/blob/bf8f05fb4cd214bea2a0e40a04827c63815edfc5/lib/theme_check/html_node.rb#L14-L61) to make it "work."
- The HTML parser depends on a native library ([nokogiri](https://nokogiri.org/)) that causes vendoring and installation problems.
- The HTML parser has slightly different results depending on OS (!)

By using a Liquid + HTML parser, we have special rules that create a tree that merges both Liquid _and_ HTML into one tree.

## Consequences

1. By having both node types in the same tree, we can make checks that span both languages more confidently.
2. By using the JavaScript parser, we can integrate the linter inside the browser and the VS Code extension without a secondary installation step (no runtime dependency).
3. The LiquidHTML parser is stricter and reduces the available design space.

## Drawbacks

1. The two parsers (ruby vs LiquidHTML) report different syntax errors.
   - The LiquidHTML parser will report unclosed nodes problems even though they are "valid" Liquid.
   - The Liquid parser will report unknown tag and tag syntax errors, the LiquidHTML parser has a fallback rule that ignores those.
2. We can't lint files we can't parse.
3. The LiquidHTML parser is stricter and reduces the available design space.

### Mitigation strategies

> The two parsers (ruby vs LiquidHTML) report different syntax errors.

There are a couple of ways to mitigate the gap in parity between the parsers:

1. Syntax errors could be fixed by a different source.
   - In the browser, by server side validation that prevents save.
   - In node, via a similar mechanism (?)

2. We could use the `Liquid <: Helpers` ohm grammar and make it more strict (remove the lax parse fallback).

> We can't lint files we can't parse

This is generally true about other linters. If we're "good enough," then we don't need to worry about this.

> The LiquidHTML parser is stricter and reduces the available design space.

We can work on parity, or make it more lax. The most problematic issue is probably the unclosed node one (which is solvable, mostly).
