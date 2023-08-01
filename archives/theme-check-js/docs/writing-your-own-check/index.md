This doc exists to outline the steps required to create your own check, share it and then use it your projects.

1. Creating a Theme Check extension
2. Sharing a Theme Check extension
3. Using a Theme Check extension

## Creating a Theme Check extension

### Naming your extension

Each Theme Check extension is an `npm` module with a name of the format `theme-check-<extension-name>`, such as `theme-check-preact`. You can also use scoped packages in the format of `@<scope>/theme-check-<extension-name>` such as `@acme/theme-check-extension`.

<!-- TODO We should offer some kind of yo generator here. -->

### Your extensions' `package.json`

#### The `name` entry

The `name` property in your `package.json` should fit the naming convention described in the [Naming your extension](#naming-your-extension) section.

#### The `main` entry

The `main` entry of your project's `package.json` is assumed to have a `checks` export containing all the checks provided by your extension:

```js
// dist/index.js
const MyFirstNewCheck = require('./checks/MyFirstNewCheck');
const MySecondNewCheck = require('./checks/MySecondNewCheck');

exports.checks = [
  MyFirstNewCheck,
  MySecondNewCheck,
];
```

Here's a `package.json` example that would use `dist/index.js` as its main entry:

```json
{
  "name": "@acme/theme-check-extension",
  "description": "Custom checks that we use",
  "main": "dist/index.js"
  "dependencies": {
    "...": "..."
  },
}
```

### Providing a recommended configuration for your checks

You may want to offer recommended configurations along with your checks so that it's really easy for users to use them.

For this, you may add any number of `.yml` file to your published package.

For instance, you may add a `recommended.yml` file at the root of your package:

```yaml
# In your extensions $root/recommended.yml file
MyFirstNewCheck:
  enabled: true
  severity: 0
MySecondNewCheck:
  enabled: true
  severity: 1
  someConfigValue: 100
```

Users can extend this configuration directly instead of providing configuration for each checks.

```yaml
# In a user's `.theme-check.yml`
extends:
  - 'theme-check:recommended'
  - '@acme/theme-check-extension/recommended.yml'
```

**Note** the `.yml` extension is required.

For a detailed explanation, see the [Using it in your projects](#Using-it-in-your-projects) section.

## Sharing a Theme Check Extension

In order to make it available for others to use, you may [publish](https://docs.npmjs.com/cli/v8/commands/npm-publish) your extension to npm.

## Using a Theme Check Extension

1. Add your Theme Check extension as a dependency of your project.

   ```bash
   npm install -D @acme/theme-check-extension
   ```

2. Reference or extend a config provided by your extension.

   ```yaml
   extends:
     - 'theme-check:recommended'
     - '@acme/theme-check-extension/recommended.yml'
   MyNonRecommendedCheck:
     enabled: true
     severity: suggestion
   ```
