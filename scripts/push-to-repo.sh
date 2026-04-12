#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# push-to-repo.sh
# Push this codebase to a branch in any GitHub repo, even with unrelated history.
#
# Usage:
#   ./scripts/push-to-repo.sh <remote-repo-url> <branch-name> [pr-title]
#
# Examples:
#   ./scripts/push-to-repo.sh https://github.com/praveenmj2001/TravelAgent.git my-branch
#   ./scripts/push-to-repo.sh https://github.com/praveenmj2001/TravelAgent.git my-branch "My PR title"
# ─────────────────────────────────────────────────────────────────────────────

set -e

REMOTE_URL=$1
BRANCH=$2
PR_TITLE=${3:-"Sync TravelAI codebase"}
TMP_DIR=$(mktemp -d)
SOURCE_DIR=$(pwd)

# ── Validate args ─────────────────────────────────────────────────────────────
if [ -z "$REMOTE_URL" ] || [ -z "$BRANCH" ]; then
  echo "Usage: $0 <remote-repo-url> <branch-name> [pr-title]"
  exit 1
fi

echo ""
echo "▶ Remote : $REMOTE_URL"
echo "▶ Branch : $BRANCH"
echo "▶ Temp   : $TMP_DIR"
echo ""

# ── Clone target repo ─────────────────────────────────────────────────────────
echo "📦 Cloning target repo..."
git clone "$REMOTE_URL" "$TMP_DIR"

# ── Switch to (or create) the target branch ───────────────────────────────────
cd "$TMP_DIR"
if git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null 2>&1; then
  echo "🌿 Checking out existing branch: $BRANCH"
  git checkout "$BRANCH"
else
  echo "🌿 Creating new branch: $BRANCH"
  git checkout -b "$BRANCH"
fi

# ── Copy source files (excluding secrets and build artifacts) ─────────────────
echo "📋 Copying files..."
rsync -av --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='*.db' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env*.local' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.DS_Store' \
  --exclude='venv' \
  --exclude='*.egg-info' \
  "$SOURCE_DIR/" "$TMP_DIR/" 2>&1 | tail -5

# ── Commit ────────────────────────────────────────────────────────────────────
cd "$TMP_DIR"
git add -A

if git diff --cached --quiet; then
  echo "✅ No changes to commit — target branch is already up to date."
else
  COMMIT_MSG="Sync TravelAI codebase — $(date '+%Y-%m-%d %H:%M')

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  git commit -m "$COMMIT_MSG"
  echo "✅ Committed."
fi

# ── Push ──────────────────────────────────────────────────────────────────────
echo "🚀 Pushing to $BRANCH..."
git push origin "$BRANCH"

# ── Open PR via gh CLI (if installed) ─────────────────────────────────────────
REPO_PATH=$(echo "$REMOTE_URL" | sed 's|https://github.com/||' | sed 's|\.git||')

if command -v gh &> /dev/null; then
  echo "🔀 Creating pull request..."
  gh pr create \
    --repo "$REPO_PATH" \
    --head "$BRANCH" \
    --base main \
    --title "$PR_TITLE" \
    --body "## Summary
Automated sync of TravelAI codebase.

Pushed from: \`$(basename $SOURCE_DIR)\`
Branch: \`$BRANCH\`
Date: \`$(date '+%Y-%m-%d %H:%M')\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)" 2>/dev/null \
  && echo "✅ PR created." \
  || echo "ℹ️  PR already exists or branch is already up to date — open manually at: https://github.com/$REPO_PATH/pull/new/$BRANCH"
else
  echo "ℹ️  gh CLI not found — open PR manually at:"
  echo "   https://github.com/$REPO_PATH/pull/new/$BRANCH"
fi

# ── Cleanup ───────────────────────────────────────────────────────────────────
echo "🧹 Cleaning up temp folder..."
rm -rf "$TMP_DIR"

echo ""
echo "✅ All done!"
echo "   Repo   : https://github.com/$REPO_PATH"
echo "   Branch : $BRANCH"
echo ""
