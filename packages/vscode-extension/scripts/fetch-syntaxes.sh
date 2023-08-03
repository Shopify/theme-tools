#!/bin/bash

# Exit early if we're running in a CI environment
if [ "$CI" == "true" ]; then
    echo "Running in a CI environment, exiting..."
    exit 0
fi

SUBMODULE_PATH="./syntaxes"

if [ -d "$SUBMODULE_PATH" ]; then
    if [ -z "$(ls -A $SUBMODULE_PATH)" ]; then
        echo "Submodule directory is empty, fetching..."
        git submodule update --init --recursive
    fi
else
    echo "Submodule directory does not exist, fetching..."
    git submodule update --init --recursive
fi