<h1 align="center" style="position: relative;" >
  <br>
    <img src="https://github.com/Shopify/theme-check-vscode/blob/main/images/shopify_glyph.png?raw=true" alt="logo" width="150" height="160">
  <br>
  Shopify Liquid
</h1>

<h4 align="center">A complete developer experience for Shopify themes</h4>

Official VS Code extension for [Shopify Liquid storefronts](https://shopify.dev/docs/storefronts/themes) and [Theme App Extensions](https://shopify.dev/docs/apps/online-store/theme-app-extensions).

![](https://github.com/Shopify/theme-check-vscode/blob/feature/readme-revamp/images/demo.gif?raw=true)

[Features](#features) | [User guide](#user-guide) | [Installation](#installation) | [Configuration](#configuration) | [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=shopify.theme-check-vscode).

## Features

* 🎨 Syntax highlighting
* 💅 Code formatting
* 💡 Code completion and documentation on hover
  * 💧 Liquid tag, filter and object
  * 🏷️ HTML tag, attribute and value
  * 🖌️ Theme, section and block settings
  * 🌐 Theme translation
  * 🖼️ Render tag snippet
* 🔎 Code navigation
* 🎎 Auto-closing pairs
* ✅ Theme checks and fixes

## User guide

Take a look at [our user guide](https://shopify.dev/docs/storefronts/themes/tools/shopify-liquid-vscode) for an in-depth demonstration and explanation of all the features.

## Installation

This VS Code extensions comes with batteries included.

## Configuration

- `"themeCheck.customChecks": "prompt" | "disabled"`, (default: `"prompt"`) controls whether the desktop extension asks for permission to execute custom JavaScript checks. This is a User setting; workspace and folder settings are ignored. Changing it restarts the language server and clears session decisions.
- `"themeCheck.checkOnOpen": boolean`, (default: `true`) makes it so theme check runs on file open.
- `"themeCheck.checkOnChange": boolean`, (default: `true`) makes it so theme check runs on file change.
- `"themeCheck.checkOnSave": boolean`, (default: `true`) makes it so theme check runs on file save.
- `"themeCheck.preloadOnBoot": boolean`, (default: `true`) makes it so all files are preloaded on extension activation.

## Custom Theme Checks

Custom checks execute JavaScript with your user permissions. The extension keeps them disabled in untrusted workspaces. In a trusted workspace, it asks for explicit permission before loading the custom checks requested by the theme.

Choose **Allow for this session** or **Keep disabled**. Decisions are kept only in memory for the current language-server session. Opening the workspace in a new VS Code window, reloading the window, or running **Liquid Theme Check: Restart Server** requires a new decision. No execution permission is saved to workspace storage, so a replacement theme at a previously approved path requires consent in the next session. Any workspace approvals saved by an earlier development build are ignored.

Session consent trusts custom code at the listed paths, including later edits and its dependencies; it does not approve exact file contents. A different theme root or set of custom module paths requires a new decision even within the same session.

To disable custom checks without prompting, open the extension's Settings page and set **Theme Check: Custom Checks** to **disabled** in User settings. You can also use:

```json
{
  "themeCheck.customChecks": "disabled"
}
```

Set it back to `"prompt"` to require explicit consent before execution. Neither this setting nor `.theme-check.yml` grants permission to execute custom code. Built-in checks continue to run when custom checks are disabled.

## License

MIT.
