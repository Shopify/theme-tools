#!/bin/bash

# Check if the correct number of arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: ./rename_dirs.sh <prefix> <dir>"
    exit 1
fi

# Assign the script arguments to variables
prefix=$1
dir=$2

# Loop through each sub-directory in the given directory
for subdir in "$dir"/*; do
    # Check if it's a directory
    if [ -d "$subdir" ]; then
        # Extract the base name of the directory
        base_name=$(basename "$subdir")
        # Rename the directory by appending the prefix
        mv "$subdir" "$dir/$prefix$base_name"
    fi
done