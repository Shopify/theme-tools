# Using prettier

## Status

Decided in late 2021.

## tl;dr

We decided to use [Prettier](https://prettier.io/) as the base for the Liquid formatter.

## Context

The logic trail goes a bit like this:

- Theme developers are front-end developers;
- Front-end developers at Shopify use Prettier;
- Prettier is the standard formatter for JavaScript, CSS, and HTML;
- Shopify themes are typically written in JavaScript, CSS and Liquid + HTML;
- Prettier should be the standard formatter for Liquid + HTML.

Moreover, folks were already asking for it:

- On [GitHub](https://github.com/Shopify/theme-check-vscode/issues/32)
- On the partner slack
- Via DMs

## Consequences

- Since Prettier is the front-end developer standard, it easily integrates in theme developer workflows.
- Since Prettier is in JavaScript, it easily integrates in the Online Store Code Editor.
- Since Prettier is in JavaScript, it is incompatible with [theme-check](https://github.com/Shopify/theme-check).
- Since Prettier is $f(AST, config)$, it requires us to write our own parser that understands HTML _and_ Liquid.
