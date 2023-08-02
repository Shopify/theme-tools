#!/bin/bash

# Fetch the latest changes from the remote repository
git fetch

# Checkout main and ensure it's up to date
git checkout main
git pull

# For each local branch
for branch in $(git branch --format "%(refname:short)" | grep -v '^main$'); do
  # Checkout and rebase onto main
  git checkout "$branch"
  git rebase main
  git push --force-with-lease
done

# Return to main when finished
git checkout main