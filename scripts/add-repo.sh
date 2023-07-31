#!/bin/bash

# Check if the correct number of arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: ./add_repo.sh <repo_name> <repo_url>"
    exit 1
fi

# Assign the script arguments to variables
repo_name=$1
repo_url=$2

# Add the remote repository
git remote add $repo_name $repo_url

# Fetch the remote repository
git fetch $repo_name

# Create a subdirectory for the repository
mkdir ./packages/$repo_name

# Merge the repository contents into the subdirectory
git read-tree --prefix=packages/$repo_name/ -u $repo_name/master

# Commit the changes
git commit -m "Imported $repo_name into $repo_name/ subdirectory"