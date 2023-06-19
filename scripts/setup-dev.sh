# A script to setup the dev environment for the Shopify VSCode extension.

# This script assumes that the following repos are present local to this repo:
#   - theme-check-js
#   - liquid-language-server

# Setup local package links for development
for p in packages/*; do
  yarn --cwd $p link
done

yarn build


# Setup liquid-language-server
cd ../liquid-language-server/

yarn link @shopify/theme-check-common
yarn
for p in packages/*; do
  yarn --cwd $p link
done

yarn build
