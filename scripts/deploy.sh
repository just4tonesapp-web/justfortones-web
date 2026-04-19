#!/usr/bin/env bash
# Deploy dist/ to gh-pages branch (avoids gh-pages lib ENAMETOOLONG on Windows)
set -e

DIST="dist"
REMOTE="origin"
BRANCH="gh-pages"

if [ ! -d "$DIST" ]; then
  echo "Error: $DIST directory not found. Run 'npm run build' first."
  exit 1
fi

# Save current branch
CURRENT=$(git rev-parse --abbrev-ref HEAD)

# Create a temp directory for the deploy
TMPDIR=$(mktemp -d)
echo "Copying dist to temp dir..."
cp -r "$DIST"/* "$TMPDIR"/

# Create orphan gh-pages branch content
cd "$TMPDIR"
git init
git checkout -b "$BRANCH"
git add -A
git commit -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Force push to remote gh-pages
REPO_URL=$(cd "$OLDPWD" && git remote get-url "$REMOTE")
git push --force "$REPO_URL" "$BRANCH"

# Cleanup
cd "$OLDPWD"
rm -rf "$TMPDIR"

echo "Deployed to $BRANCH successfully!"
