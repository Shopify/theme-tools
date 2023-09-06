#!/bin/bash

set -ex

# A script to setup the dev environment for the Shopify Admin Theme Code Editor

# This script assumes that the online-store-web repo is present. 
# We recommend that this is run in spin instances created through the theme-tools:online-store constellation

# Set up package links in the correct hierarical order so that all changes will be available in OSW


# Before anything else, we should make sure all the theme-tools packages are built.
yarn install
yarn build

# Setup local package links for development
for p in packages/*; do
  yarn --cwd $p link
done

# Setup online-store-web
cd ../online-store-web

yarn link @shopify/liquid-language-server-browser
yarn link @shopify/liquid-language-server-common
yarn link @shopify/theme-check-common
