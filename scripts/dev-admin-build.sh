#!/bin/bash

set -ex

# A script to build theme-tool changes for the dev environment of the Admin Theme Code Editor

# This script assumes that the online-store-web repo is present. 
# We recommend that this is run in spin instances created through the theme-tools:online-store constellation

# This script assumes that you ran `yarn admin:init` already and then made changes to the theme-tools packages
# Now you want to see those new changes in the Admin Theme Code Editor

# New changes need to be compiled for the linked packages to reflect correctly
yarn build

# online-store-web does some particular package caching.
# It needs to be restarted for the changes to be reflected.
cd ../online-store-web && {
  stop
  start
}