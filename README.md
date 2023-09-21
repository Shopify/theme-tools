<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Shopify Theme Tools
</h1>

<h4 align="center">Everything developer experience for Shopify themes</h4>

<p align="center">
  <a href="https://github.com/Shopify/theme-tools/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="License"></a>
  <a href="https://github.com/Shopify/theme-tools/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Shopify/theme-tools/actions/workflows/ci.yml/badge.svg"></a>
</p>

<div align="center">

🗣 [Slack](https://join.slack.com/t/shopifypartners/shared_invite/zt-sdr2quab-mGkzkttZ2hnVm0~8noSyvw) | 💬 [Discussions](https://github.com/Shopify/theme-tools/discussions) | 📝 [Changelog](./CHANGELOG.md)

</div>

## Introduction

This monorepo is home of all things dev tools for Shopify themes:

- [`@shopify/liquid-html-parser`](./packages/liquid-html-parser) — the LiquidHTML parser that powers everything.  
- [`@shopify/prettier-plugin-liquid`](./packages/prettier-plugin-liquid) — the formatter and prettier plugin for LiquidHTML.  
- [`@shopify/theme-check-common`](./packages/theme-check-common) — Runtime agnostic linter that can run in browser or Node.js.  
- [`@shopify/theme-check-browser`](./packages/browser) — Browser specific wrapper over the common library.  
- [`@shopify/theme-check-node`](./packages/node) — Node.js specific wrapper over the common library.  
- [`@shopify/theme-language-server-common`](./packages/theme-language-server-common) — Runtime agnostic [Language Server](https://microsoft.github.io/language-server-protocol/) that can run in browser or Node.js.  
- [`@shopify/theme-language-server-browser`](./packages/browser) — Browser specific wrapper over the common library.  
- [`@shopify/theme-language-server-node`](./packages/node) — Node.js specific wrapper over the common library.  
- [`theme-check-vscode`](./packages/vscode-extension) — The VS Code extension that uses it all.

These tools are also integrated in the [Online Store Code Editor](https://shopify.dev/docs/themes/tools/code-editor) and the [Shopify CLI](https://shopify.dev/docs/themes/tools/cli).

They can be used individually or collectively, catering to varied use cases and offering flexibility in their application.

## Contributing

Contributions to the Theme Tools repository are highly encouraged.

See [CONTRIBUTING.md](./docs/contributing.md) for more details.

## License

MIT.
