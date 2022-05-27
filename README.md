<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="141" height="160">
  <br>
  Shopify Liquid Prettier Plugin
  <br>
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@shopify/prettier-plugin-liquid"><img src="https://img.shields.io/npm/v/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Version"></a>
  <a href="https://github.com/Shopify/prettier-plugin-liquid/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="License"></a>
  <a href="https://github.com/Shopify/prettier-plugin-liquid-prototype/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Shopify/prettier-plugin-liquid-prototype/actions/workflows/ci.yml/badge.svg"></a>
  <!--
    <a href="https://npmcharts.com/compare/@shopify/prettier-plugin-liquid?minimal=true"><img src="https://img.shields.io/npm/dm/@shopify/prettier-plugin-liquid.svg?sanitize=true" alt="Downloads"></a>
  -->
</p>

<div align="center">

🗣 [Slack](https://join.slack.com/t/shopifypartners/shared_invite/zt-sdr2quab-mGkzkttZ2hnVm0~8noSyvw) | 💬 [Discussions](https://github.com/Shopify/prettier-plugin-liquid/discussions) | 📝 [Changelog](./CHANGELOG.md)

</div>

Prettier is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing it with its own rules that take the maximum line length into account, wrapping code when necessary.

**This is the developer preview** of the Liquid/HTML prettier plugin.

https://user-images.githubusercontent.com/4990691/145229362-568ab7d4-4345-42b7-8794-59f7683a88a3.mp4

## Can this be used in production?

_Not yet_. We have a [list of issues](https://github.com/Shopify/prettier-plugin-liquid/issues) we're going through before it is considered stable.

## Installation

```bash
# with npm
npm install --save-dev prettier @shopify/prettier-plugin-liquid

# with yarn
yarn add --dev prettier @shopify/prettier-plugin-liquid
```

## Usage

See our [Wiki](https://github.com/Shopify/prettier-plugin-liquid/wiki) pages on the subject:

- [In the terminal](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-your-terminal) (with Node.js)
- [In the browser](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-the-browser)
- [In your editor](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-your-editor)
- [In a CI workflow](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-in-CI)
- [As a precommit hook](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-as-a-precommit-hook)
- [With a bundler](https://github.com/shopify/prettier-plugin-liquid/wiki/Use-it-with-a-bundler)

## Configuration

Prettier for Liquid supports the following options.

| Name                        | Default   | Description                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------          | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `printWidth`                | `120`     | Changed from Prettier's default (`80`) ([see prettier docs](https://prettier.io/docs/en/options.html#print-width))                                                                                                                                                                                                                                                                    |
| `tabWidth`                  | `2`       | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tab-width))                                                                                                                                                                                                                                                                                         |
| `useTabs`                   | `false`   | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#tabs))                                                                                                                                                                                                                                                                                              |
| `singleQuote`               | `false`   | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#quotes))                                                                                                                                                                                                                                                                                            |
| `htmlWhitespaceSensitivity` | `css`     | Same as in Prettier ([see prettier docs](https://prettier.io/docs/en/options.html#html-whitespace-sensitivity))                                                                                                                                                                                                                                                                       |
| `singleLineLinkTags`        | `false`   | If set to `true`, will print `<link>` tags on a single line to remove clutter                                                                                                                                                                                                                                                                                                         |
| `indentSchema`              | `false`   | If set to `true`, will indent the contents of the `{% schema %}` tag                                                                                                                                                                                                                                                                                                                  |

## Known issues

Take a look at our [known issues](./KNOWN_ISSUES.md) and [open issues](https://github.com/Shopify/prettier-plugin-liquid/issues).

## Contributing

[Read our contributing guide](CONTRIBUTING.md)

## License

MIT.
