---
'@shopify/theme-check-browser': major
'@shopify/theme-check-common': major
'@shopify/theme-check-node': major
---

**Theme Check 2.0**

Our official release of the next iteration of Theme Check, the linter for Shopify themes.

What is is: A TypeScript rewrite of [Theme Check](https://github.com/Shopify/theme-check).

But... _why_? A couple of reasons:

- To lint Liquid files, we prefer _one_ Abstract Syntax Tree (AST) per file. Not one Liquid AST _and_ one HTML AST.
  - Theme Check Ruby had weird duplicated checks because of that (such as `ParserBlockingJavaScript` and `ParserBlockingScriptTag`)
  - For that we reused the `@shopify/liquid-html-parser` we wrote for the prettier plugin.
  - One tree, two languages.
- We wanted to run the linter in the Online Store Code Editor and—unlike WASM or WebSockets—there is no overhead or latency cost to running a TypeScript-based Language Server in a Web Worker.
- Theme developers are Front End developers. If we were to make a Venn diagram, we'd observe that the intersection of Ruby _and_ Theme developers is much smaller than that of JavaScript _and_ Theme developers.
  - This makes the TypeScript codebase easier to contribute to.
  - This makes the plugin ecosystem more accessible (you're more likely to have a `package.json` file in a theme than a `Gemfile`).
- The `@shopify/cli` was rewritten in TypeScript. This made the Ruby integration very problematic.
  - Windows performance was terrible
  - Installation setup was weird, often problematic and complicated
- The VS Code extension required a secondary installation step, and thus lost the ability to automatically self-update

With the move to TypeScript, we believe that it will make it easier for us to ship more robust features _faster_.
