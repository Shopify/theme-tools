---
'theme-check-vscode': major
---

**Shopify Liquid VS Code and Theme Check 2.0**

This new major version is the grand unification of Shopify theme developer tools.

Going forward, all Language Server Protocol features (Intelligent Code Completion, hover documentation, theme checks, code navigation, etc.) will be shared with the Online Store Code Editor.

This is the culmination of the major rewrite of our Ruby language server and linter to TypeScript.

It includes a re-architecture of the linter and Language Server to work on a LiquidHTML AST.

**Major changes:**

- Hover documentation support
- New completion providers
  - HTML tag, attribute and value
  - Theme, section and block settings
  - Theme translations
- Improved Type System
- Automatically updated
- Polished auto-closing pair UX
- Proper monorepo and VS Code workspace support
  - For those of you working on large projects
- Comes with batteries included
  - No longer requires a Ruby installation
- Bring your own checks and/or publish them to npm
- Runs in browser too
