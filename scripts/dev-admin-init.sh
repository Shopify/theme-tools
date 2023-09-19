#!/bin/bash

set -ex

# A script to setup the dev environment of the Admin Theme Code Editor

# This script assumes that the online-store-web repo is present. 
# We recommend that this is run in spin instances created through the theme-tools:online-store constellation

# Ensure all the theme-tools package assets are ready
yarn install
yarn build

# Setup local package links for development
for p in packages/*; do
  yarn --cwd $p link
done

# Setup online-store-web
cd ../online-store-web && {
  # Set up package links in the correct hierarical order so that all changes will be available in OSW
  yarn link @shopify/theme-language-server-browser
  yarn link @shopify/theme-language-server-common
  yarn link @shopify/theme-check-common
  stop
  start
}

echo "You are ready to start developing in the Shopify Admin Theme Code Editor!"
echo "To see your dev changes, please run 'yarn admin:build`"
