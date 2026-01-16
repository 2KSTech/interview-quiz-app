#!/bin/bash
# Test importing from a specific GitHub commit
# Usage: ./test-import-commit.sh <commit-hash>
# Example: ./test-import-commit.sh cb7c9a5

set -e

COMMIT_HASH=${1:-cb7c9a5}
VENDOR_DIR="vendor/quizzes"
BACKUP_SUFFIX=$(date +%Y%m%d_%H%M%S)

echo "🧪 Testing import from commit: $COMMIT_HASH"
echo ""

# Step 1: Backup current database
echo "█ Step 1: Backing up current database..."
cp quizdb.sqlite "quizdb.sqlite.backup.$BACKUP_SUFFIX"
echo "✔ Backup created: quizdb.sqlite.backup.$BACKUP_SUFFIX"
echo ""

# Step 2: Backup current vendor/quizzes state (if it's a git repo)
if [ -d "$VENDOR_DIR/.git" ]; then
    echo "█ Step 2: Backing up vendor/quizzes git state..."
    cd "$VENDOR_DIR"
    CURRENT_BRANCH=$(git branch --show-current)
    CURRENT_COMMIT=$(git rev-parse HEAD)
    cd - > /dev/null
    echo "   Current branch: $CURRENT_BRANCH"
    echo "   Current commit: $CURRENT_COMMIT"
    echo "✔ Git state noted"
else
    echo "[WARN]  Step 2: vendor/quizzes is not a git repo, skipping git backup"
fi
echo ""

# Step 3: Checkout the test commit
if [ -d "$VENDOR_DIR/.git" ]; then
    echo "█ Step 3: Checking out commit $COMMIT_HASH..."
    cd "$VENDOR_DIR"
    git checkout "$COMMIT_HASH" 2>&1
    cd - > /dev/null
    echo "✔ Checked out commit $COMMIT_HASH"
else
    echo "⚠ Step 3: Cannot checkout - vendor/quizzes is not a git repo"
    exit 1
fi
echo ""

# Step 4: Test import with the new commit
echo "█ Step 4: Testing import with QUIZ_COMMIT=$COMMIT_HASH..."

# Test importing one topic first (bash)
echo "   Testing import of 'bash' topic..."
TOPIC_SLUG=bash
TOPIC_NAME=Bash
LOCAL_FILE="$VENDOR_DIR/$TOPIC_SLUG/$TOPIC_SLUG-quiz.md"

if [ ! -f "$LOCAL_FILE" ]; then
    echo "⚠ Error: $LOCAL_FILE not found"
    exit 1
fi

cd "$(dirname "$0")/.." || exit 1

LOCAL_FILE="$LOCAL_FILE" \
TOPIC_SLUG="$TOPIC_SLUG" \
TOPIC_NAME="$TOPIC_NAME" \
QUIZ_COMMIT="$COMMIT_HASH" \
SOURCE_NAME="Test Import" \
INDUSTRY_SPECIFIC=0 \
node scripts/import-bash-quiz.js

if [ $? -eq 0 ]; then
    echo "✔ Import test successful"
else
    echo "⚠ Import test failed"
    exit 1
fi
echo ""

# Step 5: Restore vendor/quizzes to original state
if [ -d "$VENDOR_DIR/.git" ]; then
    echo "█ Step 5: Restoring vendor/quizzes to original state..."
    cd "$VENDOR_DIR"
    git checkout "$CURRENT_BRANCH" 2>&1
    cd - > /dev/null
    echo "✔ Restored to branch $CURRENT_BRANCH"
fi
echo ""

echo "✔ Test complete!"
echo ""
echo "Summary:"
echo "  - Database backed up to: quizdb.sqlite.backup.$BACKUP_SUFFIX"
echo "  - Tested import from commit: $COMMIT_HASH"
echo "  - Vendor repo restored to original state"
echo ""
echo "To restore database if needed:"
echo "  cp quizdb.sqlite.backup.$BACKUP_SUFFIX quizdb.sqlite"
