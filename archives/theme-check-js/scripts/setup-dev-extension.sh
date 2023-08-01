# A script to setup the dev environment for the Shopify VSCode extension.

# This script assumes that the following repos are present local to theme-check-js repo root:
#   - liquid-language-server
#   - theme-check-vscode

# setup-dev-extension.sh was expected to have been run from theme-check-js repo root
sh ./scripts/setup-dev.sh

# Setup theme-check-vscode
cd ../theme-check-vscode

# Checkout the branch that supports onlineStoreCodeEditorMode
git checkout feature/batteries-included

# Setup for syntax highlighting
git submodule update --init --recursive

yarn

yarn link @shopify/liquid-language-server-node

cd ../theme-check-js
sh ./scripts/build-local-pkgs.sh

echo "You're all set up!
To run this local development version of the theme-check extension:

- Open the theme-check-vscode folder in VSCode:
code ../theme-check-vscode

- If prompted for recommended extensions, install them.
- From VS Code, Run > debug > 'npm run build:extension:dev'.
  This starts a new Window called \"Extension Host\" which runs the extension in debug mode.

- In the Settings.json, set these setting:
\"shopifyLiquid.onlineStoreCodeEditorMode\": true,
\"shopifyLiquid.trace.server\": \"verbose\",

- Now simply open a theme directory in the VSCode window and you should see the checks running.
  If you do not have a theme directory, we recommend starting out with Dawn: https://github.com/Shopify/dawn

To rebuild new changes, you only need to run the following from the theme-check-js repo root:

sh scripts/build-local-pkgs.sh"