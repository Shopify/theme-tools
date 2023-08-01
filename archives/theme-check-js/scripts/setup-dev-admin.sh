# A script to setup the dev environment for the Shopify Admin Theme Code Editor

# This script assumes that the following repos are present local to theme-check-js repo root:
#   - liquid-language-server
#   - online-store-web

# setup-dev-extension.sh was expected to have been run from theme-check-js repo root
sh ./scripts/setup-dev.sh

# Create the yarn links that will point to the packages built local to this instance
cd ../online-store-web

yarn link @shopify/liquid-language-server-browser
yarn link @shopify/liquid-language-server-common
yarn link @shopify/theme-check-common
