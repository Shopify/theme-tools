# Writing your own check

This document outlines the steps required to create your own check, share it, and then use it in your projects.

1. Creating a theme check extension
2. Sharing a theme check extension
3. Using a theme check extension

## Creating a theme check extension

### Naming your extension

Each theme check extension is an `npm` module with a name in the format `theme-check-<extension-name>`, such as `theme-check-preact`. You can also use scoped packages in the format `@<scope>/theme-check-<extension-name>`, such as `@acme/theme-check-extension`.

### Your extension's `package.json`

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
  "main": "dist/index.js",
  "dependencies": {
    "...": "..."
  },
}
```

### Providing a recommended configuration for your checks

You may want to offer recommended configurations along with your checks to make it easy for users to use them.

For this, you can add any number of `.yml` files to your published package.

For instance, you may add a `recommended.yml` file at the root of your package:

```yaml
# In your extension's $root/recommended.yml file
MyFirstNewCheck:
  enabled: true
  severity: 0
MySecondNewCheck:
  enabled: true
  severity: 1
  someConfigValue: 100
```

Users can extend this configuration directly instead of providing configuration for each check.

```yaml
# In a user's `.theme-check.yml`
extends:
  - 'theme-check:recommended'
  - '@acme/theme-check-extension/recommended.yml'
```

**Note:** the `.yml` extension is required.

For a detailed explanation, see the [Using it in your projects](#Using-it-in-your-projects) section.

## Sharing a theme check extension

To make it available for others to use, you can [publish](https://docs.npmjs.com/cli/v8/commands/npm-publish) your extension to npm.

## Using a theme check extension

1. Add your theme check extension as a dependency of your project.

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
