#!/bin/bash

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