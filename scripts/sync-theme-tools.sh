#!/bin/bash

################################################################################
## Validate the git remotes are set up correctly

if [ -z "$BASH_VERSION" ]; then
  echo "❌ Error: This script requires bash. Please run with: bash $0"
  exit 1
fi

expected_remote_names=("origin" "play")
expected_remote_urls=(
  "git@github.com:Shopify/theme-tools.git"
  "git@github.com:shopify-playground/theme-tools.git"
)

get_remote_url() {
  local remote_name="$1"
  git remote get-url "$remote_name" 2>/dev/null
}

check_remote() {
  local remote_name="$1"
  local expected_url="$2"

  local actual_url=$(get_remote_url "$remote_name")

  if [[ -z "$actual_url" ]]; then
    echo ""
    echo "❌ Error: Remote '$remote_name' is not configured."
    return 1
  fi

  if [[ "$actual_url" != "$expected_url" ]]; then
    echo ""
    echo "❌ Error: Remote '$remote_name' has incorrect URL."
    echo "Expected: $expected_url"
    echo "Actual  : $actual_url"
    return 1
  fi

  return 0
}

show_fix_instructions() {
  echo ""
  echo "To fix your remotes, run:"
  echo ""
  echo "  git remote rm origin"
  echo "  git remote rm play"
  echo "  git remote add origin git@github.com:Shopify/theme-tools.git"
  echo "  git remote add play git@github.com:shopify-playground/theme-tools.git"
  echo ""
}

if ! command -v git &> /dev/null; then
  echo ""
  echo "❌ Error: git command not found."
  exit 1
fi

if ! git rev-parse --git-dir &> /dev/null; then
  echo ""
  echo "❌ Error: Not in a git repository."
  exit 1
fi

errors=0
for i in "${!expected_remote_names[@]}"; do
  remote_name="${expected_remote_names[$i]}"
  expected_url="${expected_remote_urls[$i]}"
  if ! check_remote "$remote_name" "$expected_url"; then
    errors=$((errors + 1))
  fi
done

if [[ $errors -gt 0 ]]; then
  show_fix_instructions
  exit 1
fi

################################################################################
## Check working directory is clean

if ! git diff-index --quiet HEAD --; then
  echo ""
  echo "❌ Error: You have uncommitted changes in your working directory."
  exit 1
fi

if [[ -n $(git ls-files --others --exclude-standard) ]]; then
  echo ""
  echo "❌ Error: You have uncommitted changes in your working directory."
  exit 1
fi

################################################################################
## Sync

echo ""
echo "✨ Starting sync process..."
echo "   - This process updates the 'upstream' branch in the playground"
echo "   - This process won't update the main branch in the playground (you'll need to do that manually, as you might need to solve conflicts)"

echo ""
echo "✨ Fetching from remotes..."
git fetch origin && git fetch play

echo ""
echo "🔄 Updating 'upstream' branch..."
git branch -D upstream 2>/dev/null || true
git checkout -b upstream
git reset origin/main --hard
git push play upstream -f

echo ""
echo "🔄 Rebasing main onto upstream..."
git checkout main
git reset origin/main --hard
git rebase upstream

echo ""
echo "✨ Sync completed successfully! Now you can run:"
echo "   git push play main -f"
