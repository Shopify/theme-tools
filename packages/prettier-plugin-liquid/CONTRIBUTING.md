# Contributing to @shopify/prettier-plugin-liquid

Requirements:

- Node v16+
- Yarn

```
git clone git@github.com:Shopify/prettier-plugin-liquid.git
yarn
yarn test
```

## Context

There's a lot of abstract concepts that goes into making this plugin.

- Take a look at our plugin's [principles](./docs/principles/index.md).
- Read [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for a technical overview.
- Read [Whitespace Handling](./docs/whitespace-handling.md) for an overview of how we deal with that internally.

The source code for this plugin is in TypeScript.

## Standards

- PR should explain what the feature does, and why the change exists.
- PR should include any carrier specific documentation explaining how it works.
- Code should be generic and reusable.

## Formating

This plugin uses prettier to format its TypeScript codebase. To format your code before a commit, run the following command:

```
yarn format
```

## Testing

This prettier plugin has two suites of tests: unit tests and integration tests.

To run the unit tests:

```bash
yarn test:unit
```

To run the integration tests (where we make sure an input file gets transformed into another after running prettier):

```bash
yarn test:integration
```

To run the idempotence tests (where we make sure running prettier twice on an input file returns the same result):
```bash
yarn test:idempotence
```

To run all tests:

```bash
yarn test
```

To run from source on another repo or file:

```bash
# build the code so you can run it (only need to do it once)
yarn build

# run prettier on a file or folder
prettier --plugin . --write path/to/files.liquid
```

## Running from source on another code base

### Adding new integration tests

- Copy any of the folder in the `test/` directory and rename it to something appropriate.
- In the `index.liquid` file, type code that should be made prettier
- In the `fixed.liquid` file, type what you'd expect the plugin to output

## How to contribute

1. Fork it ( https://github.com/Shopify/prettier-plugin-liquid/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
