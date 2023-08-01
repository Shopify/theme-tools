# Contributing to theme-check-js

Thank you for your interest in contributing to theme-check-js! Your contributions will help make this project better and more reliable. This document provides guidelines and instructions for setting up your development environment and contributing to the theme-check-js repository.

## Table of Contents

- [Setting Up Your Environment](#setting-up-your-environment)
- [Setup for the VSCode Extension](#setup-for-the-vscode-extension)
- [Setup for the Online Store](#setup-for-the-online-store)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)

## Setting Up Your Environment

Before you can start contributing to theme-check-js, you'll need to set up your development environment. Follow these steps to get started:

1. **Clone the repository**: Clone the theme-check-js repository to your local machine by running the following command in your terminal:

   ```bash
   git clone https://github.com/Shopify/theme-check-js.git
   ```

2. **Install dependencies**: Navigate to the project directory and install the required dependencies by running:

   ```bash
   cd theme-check-js
   yarn
   ```

3. **Run tests**: Ensure that all tests pass by running:

   ```bash
   yarn test
   ```

4. **Setup for your usecase**:
  
   If you are a third party developer external to shopify, you will most likely be developing for the VSCode extension. You can find the next setup steps here: [Setup for the VSCode Extension](#setup-for-the-vscode-extension).

   For Shopify internal developers, you may wish to test your checks against the Admin Theme Code Editor. You can find the next setup steps here: [Setup for the Online Store](#setup-for-the-online-store).

## Setup for the VSCode Extension
To get started with developing checks for the VSCode extension, you will additionally need two more repos cloned. Those repos are:
- [liquid-language-server](https://github.com/Shopify/liquid-language-server): A runtime-agnostic Liquid Language Server to interface with the checks in theme-check-js.
- [theme-check-vscode](https://github.com/Shopify/theme-check-vscode): The official VS Code extension for Shopify Liquid.

These repos should be present at the same root level as this repo in your file tree.

Example:
```
├── git
│   ├── theme-check-js
│   ├── liquid-language-server
│   ├── theme-check-vscode
```
Once your directory structure looks like this, run the following command to set up your environment
   ```bash
   yarn setup:extension
   ```
Once that is done, you're ready to start using your custom build of the theme-check extension!

- Open the theme-check-vscode folder in VSCode:
code ../theme-check-vscode

- If prompted for recommended extensions, install them.
- From VS Code, Run > debug > 'npm run build:extension:dev'.
  This starts a new Window called \"Extension Host\" which runs the extension in debug mode.

- In the Settings.json, set these setting:
```json
"shopifyLiquid.onlineStoreCodeEditorMode": true,
"shopifyLiquid.trace.server": "verbose",
```
- Now simply open a theme directory in the VSCode window and you should see the checks running.

Now your development environment is set up, and you can start making changes to the codebase!

If you do not have local theme files to test your extension build against, we recommend our main theme [Dawn](https://github.com/Shopify/dawn).

To rebuild new changes, you only need to run the following command from the theme-check-js repo root:

```bash
yarn build:links
```

## Setup for the Online Store
**This section only pertains to internal Shopify devs.**

To get started with developing checks for the online store, you will additionally need two more repos cloned. Those repos are:
- [liquid-language-server](https://github.com/Shopify/liquid-language-server): A runtime-agnostic Liquid Language Server to interface with the checks in theme-check-js.
- online-store-web

These repos should be present at the same root level as this repo in your file tree.

Example:
```
├── git
│   ├── theme-check-js
│   ├── liquid-language-server
│   ├── online-store-web
```
Once your directory structure looks like this, run the following command to set up your environment
   ```bash
   yarn setup:admin
   ```
If everything is successful, you just need to `restart` online-store-web and when you open the Theme Code Editor, it will be using your local theme-check-js package.

To rebuild new changes, you only need to run the following command from the theme-check-js repo root:

```bash
yarn build:links
```

## Submitting a Pull Request

Once you've made changes to the codebase and are ready to submit a pull request (PR), follow these steps:

1. **Commit your changes**: Commit your changes with a descriptive commit message.

2. **Push your changes**: Push your changes to the theme-check-js repository on GitHub.

3. **Create a pull request**: Go to the theme-check-js repository and click on the "New Pull Request" button. Select the branch containing your changes as the head branch.

4. **Describe your changes**: Write a clear and concise description of the changes you made, the issue or feature request it addresses, and any additional information that may be helpful for reviewers.

5. **Submit your pull request**: Click the "Create Pull Request" button to submit your PR for review.

## Code of conduct

All developers who wish to contribute through code or issues, please first read our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Reporting Issues

If you encounter any issues or have suggestions for improvements, please feel free to report them by creating a new issue in the theme-check-js repository. When reporting an issue, please follow these guidelines to help us better understand and address your concerns:

1. **Check for existing issues**: Before creating a new issue, please search the existing issues to see if someone has already reported the problem or made the same suggestion.

2. **Choose the right issue template**: When creating a new issue, select the appropriate issue template (if available) to provide the necessary information.

3. **Provide a clear title**: Write a concise and descriptive title that briefly summarizes the issue or suggestion.

4. **Describe the issue in detail**: In the issue description, provide as much relevant information as possible. Include steps to reproduce the issue, any error messages, the expected behavior, and the actual behavior. If applicable, include screenshots or screen recordings to help illustrate the problem.

5. **Include your environment**: Mention the version of theme-check-js you are using, as well as any relevant information about your operating system, Node.js version, and browser (if applicable).

By following these guidelines, you'll help us better understand the issue and address it more effectively. We appreciate your feedback and contributions!