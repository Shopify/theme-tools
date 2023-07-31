#!/bin/bash

# Check if the correct number of arguments are provided
if [ "$#" -ne 1 ]; then
    echo "Usage: ./add_repo.sh <repo_url>"
    exit 1
fi

# Assign the script argument to variable
repo_url=$1

# Extract the repo_name from the repo_url
repo_name=$(basename -s .git "$repo_url")

# Add the remote repository
git remote add $repo_name $repo_url

# Fetch the remote repository
git fetch $repo_name

# Merge the repository contents into a subdirectory of the current HEAD
git subtree add --prefix=packages/$repo_name $repo_name main

# Remove the remote repository
git remote remove $repo_name