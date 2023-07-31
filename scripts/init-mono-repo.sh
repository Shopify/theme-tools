#!/bin/bash

## This script is meant for initializing this entire theme-tools monorepo. 
## Execute this from the repo root with 
##
## sh ./scripts/init-mono-repo.sh   
##


# Add all the repos into this branch
sh ./scripts/add-repo.sh git@github.com:Shopify/theme-check-js.git
sh ./scripts/add-repo.sh git@github.com:Shopify/theme-check-vscode.git vscode-extension
sh ./scripts/add-repo.sh git@github.com:Shopify/liquid-language-server.git
sh ./scripts/add-repo.sh git@github.com:Shopify/prettier-plugin-liquid.git

# Lift all the packages out of the repo directories
sh ./scripts/rename-all-dirs.sh theme-check- packages/theme-check-js/packages
sh ./scripts/rename-all-dirs.sh theme-language-server- packages/liquid-language-server/packages

git add ./packages/*

git commit -m "Renamed theme-check-js and liquid-language-server packages

This change renames all packages within packages/theme-check-js/packages with the prefix 'theme-check-'.
This change renames all packages within packages/liquid-language-server/packages with the prefix 'theme-liquid-server-'."

# Move all renamed packages up to the main packages directory
mv packages/theme-check-js/packages/* packages/
mv packages/liquid-language-server/packages/* packages/

git add ./packages/*
git commit -m "Surface theme-check-js and liquid-language-server packages                                                                                                  unify

This change moves all packages within packages/theme-check-js/packages into the top level packages directory.
This change moves all packages within packages/liquid-language-server/packages into the top level packages directory."

# Move outdated monorepo packages to a separate archives directory for manual refinement and processing
mkdir ./archives
mv packages/theme-check-js archives/
mv packages/liquid-language-server archives/

git add ./archives/*
git commit -m "Move outdated monorepos to archives directory"